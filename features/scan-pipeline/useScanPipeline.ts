
import { useState, useCallback, useRef, useEffect } from 'react';
import { BusinessCardData, ProcessingTask } from '../../types';
import { compressImage } from '../../utils/imageUtils';
import { extractCardInfo } from '../../services/geminiService';
import { uploadImageAsset } from '../../utils/firebase';
import { saveCardToDB, deleteCardFromDB } from '../../services/dbService';
import { apiFetch } from '../../utils/apiClient';
import {
  DEFAULT_CARD_SOURCE,
  inferCountryFromCard,
  auditCardQsCategory,
} from '../../utils/qsValidation';

const SCAN_CONCURRENCY = 2;
const MAX_EXTRACT_RETRIES = 2;

const isRetryableError = (err: any): boolean => {
  const msg = String(err?.message || '');
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('Timeout') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError')
  );
};

async function extractWithBackoff(base64Data: string, mimeType: string) {
  let attempt = 0;
  while (true) {
    try {
      return await extractCardInfo(base64Data, mimeType);
    } catch (err) {
      if (attempt >= MAX_EXTRACT_RETRIES || !isRetryableError(err)) {
        throw err;
      }
      attempt++;
      const delayMs = 900 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export const useScanPipeline = (
  cardsRef: React.MutableRefObject<BusinessCardData[]>,
  setCards: React.Dispatch<React.SetStateAction<BusinessCardData[]>>,
  tasks: ProcessingTask[],
  setTasks: React.Dispatch<React.SetStateAction<ProcessingTask[]>>,
  filesMap: React.MutableRefObject<Map<string, File | Blob>>,
  setDuplicatePrompt: React.Dispatch<React.SetStateAction<any>>,
  setDuplicateFilePrompt: React.Dispatch<React.SetStateAction<any>>
) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const activeCountRef = useRef(0);
  const claimedTaskIdsRef = useRef<Set<string>>(new Set());
  const promptLockRef = useRef<Promise<void>>(Promise.resolve());
  const tasksRef = useRef<ProcessingTask[]>(tasks);
  const pausedRef = useRef(isQueuePaused);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  useEffect(() => {
    pausedRef.current = isQueuePaused;
  }, [isQueuePaused]);

  const runPromptSerialized = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    let release!: () => void;
    const prev = promptLockRef.current;
    promptLockRef.current = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }, []);

  const performSingleTask = useCallback(
    async (task: ProcessingTask) => {
      try {
        const fileObj = filesMap.current.get(task.id);
        if (!fileObj) throw new Error('File missing from memory');

        const duplicateFile = cardsRef.current.find(
          (c) => c.originalFileName === (fileObj as any).name && c.originalFileSize === fileObj.size
        );

        if (duplicateFile) {
          const action = await runPromptSerialized(
            () =>
              new Promise<'process' | 'skip'>((resolve) => {
                setDuplicateFilePrompt({
                  fileName: (fileObj as any).name || 'unknown',
                  resolve,
                });
              })
          );
          setDuplicateFilePrompt(null);
          if (action === 'skip') {
            setTasks((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t))
            );
            filesMap.current.delete(task.id);
            setTimeout(() => {
              if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
              setTasks((prev) => prev.filter((t) => t.id !== task.id));
            }, 1500);
            return;
          }
        }

        const processWithTimeout = async () => {
          const base64Data = await compressImage(fileObj);
          const [info, uprightRes] = await Promise.all([
            extractWithBackoff(base64Data, 'image/jpeg'),
            apiFetch('/api/cards/auto-upright', {
              method: 'POST',
              body: JSON.stringify({ base64: base64Data, mimeType: 'image/jpeg' }),
            })
              .then((r) => r.json())
              .catch(() => ({ rotation: 0 })),
          ]);
          return { base64Data, info, autoRotation: Number(uprightRes?.rotation || 0) };
        };

        const timeoutPromise = new Promise<{
          base64Data: string;
          info: any;
          autoRotation: number;
        }>((_, reject) => setTimeout(() => reject(new Error('Timeout (50s)')), 50000));

        const { base64Data, info, autoRotation } = await Promise.race([
          processWithTimeout(),
          timeoutPromise,
        ]);

        let imageUrl = `data:image/jpeg;base64,${base64Data}`;
        let imageId: string | undefined = undefined;
        let imagePath: string | undefined = undefined;
        try {
          const uploadResult = await uploadImageAsset(imageUrl, task.id, 'front');
          imageUrl = uploadResult.downloadUrl;
          imageId = uploadResult.imageId;
          imagePath = uploadResult.storagePath;
        } catch (e) {
          console.error('Firebase upload failed during scan', e);
        }

        const now = Date.now();
        const draftCard: BusinessCardData = {
          notes: '',
          prefix: '',
          fax: '',
          summary: '',
          reasoning: '',
          ...info,
          id: task.id,
          scannedAt: now,
          updatedAt: now,
          source: DEFAULT_CARD_SOURCE,
          followUpStatus: 'new',
          activityLog: [
            {
              id: crypto.randomUUID(),
              at: now,
              type: 'created',
              text: '透過 AI 掃描辨識建立名片檔案',
            },
          ],
          rotation: autoRotation,
          imageUrl,
          imagePath,
          imageId,
          originalFileName: (fileObj as any).name,
          originalFileSize: fileObj.size,
          syncStatus: imageUrl.startsWith('http') ? 'firebase' : 'local',
        };

        const inferredCtry = inferCountryFromCard(draftCard);
        if (inferredCtry && !draftCard.country) {
          draftCard.country = inferredCtry;
        }
        const qsAudit = auditCardQsCategory(draftCard);
        if (qsAudit.hasError) {
          draftCard.category = qsAudit.suggestedCategory;
        }

        const newCard: BusinessCardData = draftCard;

        // Robust similarity / duplicate check
        let similarityReason = '';
        const duplicate = cardsRef.current.find((c) => {
          if (
            c.email &&
            newCard.email &&
            c.email.trim().toLowerCase() === newCard.email.trim().toLowerCase()
          ) {
            similarityReason = `電子郵件相同 (${c.email})`;
            return true;
          }

          const cleanPhone = (p: string) => p.replace(/\D/g, '');
          const cPhone = cleanPhone(c.phone || '');
          const newPhone = cleanPhone(newCard.phone || '');
          if (cPhone && newPhone && cPhone.length >= 8 && cPhone === newPhone) {
            similarityReason = `電話號碼相同 (${c.phone})`;
            return true;
          }

          const cFullName = `${c.lastName || ''}${c.firstName || ''}`.trim().toLowerCase();
          const newFullName = `${newCard.lastName || ''}${newCard.firstName || ''}`
            .trim()
            .toLowerCase();
          const cComp = (c.company || '').trim().toLowerCase();
          const newComp = (newCard.company || '').trim().toLowerCase();

          if (cFullName && newFullName && cFullName === newFullName) {
            if (cComp === newComp && cComp !== '') {
              similarityReason = '姓名與公司名稱完全相同';
              return true;
            }
            if (
              cComp === '' ||
              newComp === '' ||
              cComp.includes(newComp) ||
              newComp.includes(cComp)
            ) {
              similarityReason = `姓名相同 (${cFullName})，且公司相似或其中一方未填寫`;
              return true;
            }
          }

          if (cFullName && newFullName && cFullName.length >= 2 && newFullName.length >= 2) {
            const namesIntersect =
              cFullName.includes(newFullName) || newFullName.includes(cFullName);
            const companyIntersect =
              cComp && newComp && (cComp.includes(newComp) || newComp.includes(cComp));
            if (namesIntersect && companyIntersect) {
              similarityReason = '姓名與公司名稱高度相似';
              return true;
            }
          }

          return false;
        });

        if (duplicate) {
          const action = await runPromptSerialized(
            () =>
              new Promise<'replace' | 'keep' | 'discard'>((resolve) => {
                setDuplicatePrompt({
                  newCard,
                  oldCard: duplicate,
                  reason: similarityReason,
                  resolve,
                });
              })
          );
          setDuplicatePrompt(null);
          if (action === 'discard') {
            setTasks((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t))
            );
            filesMap.current.delete(task.id);
            setTimeout(() => {
              if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
              setTasks((prev) => prev.filter((t) => t.id !== task.id));
            }, 1500);
            return;
          } else if (action === 'replace') {
            await deleteCardFromDB(duplicate.id);
            setCards((prev) => prev.filter((c) => c.id !== duplicate.id));
          }
        }

        const saved = await saveCardToDB(newCard);
        setCards((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)].sort((a, b) => b.scannedAt - a.scannedAt));
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t))
        );
        filesMap.current.delete(task.id);
        setTimeout(() => {
          if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
        }, 1500);
      } catch (err: any) {
        console.error(`Task ${task.id} Failed:`, err);
        let errorMsg = err.message || '處理失敗';
        if (
          errorMsg.includes('spending cap') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('429')
        ) {
          errorMsg = 'AI 配額暫時達上限 (429)';
        } else if (errorMsg.includes('Timeout')) {
          errorMsg = 'AI 回應超時';
        } else if (errorMsg.includes('500') || errorMsg.includes('Internal')) {
          errorMsg = '伺服器錯誤 (500)';
        }
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'error', error: errorMsg } : t))
        );
      }
    },
    [
      cardsRef,
      filesMap,
      runPromptSerialized,
      setCards,
      setDuplicateFilePrompt,
      setDuplicatePrompt,
      setTasks,
    ]
  );

  const pumpQueue = useCallback(() => {
    if (pausedRef.current) return;

    while (activeCountRef.current < SCAN_CONCURRENCY) {
      const nextTask = tasksRef.current.find(
        (t) => t.status === 'pending' && !claimedTaskIdsRef.current.has(t.id)
      );
      if (!nextTask) break;

      claimedTaskIdsRef.current.add(nextTask.id);
      activeCountRef.current += 1;
      setIsProcessing(true);
      setTasks((prev) =>
        prev.map((t) => (t.id === nextTask.id ? { ...t, status: 'processing' } : t))
      );

      performSingleTask(nextTask).finally(() => {
        claimedTaskIdsRef.current.delete(nextTask.id);
        activeCountRef.current = Math.max(0, activeCountRef.current - 1);
        if (activeCountRef.current === 0) {
          setIsProcessing(false);
        }
        setTimeout(() => {
          pumpQueue();
        }, 180);
      });
    }
  }, [performSingleTask, setTasks]);

  useEffect(() => {
    if (!isQueuePaused) {
      pumpQueue();
    }
  }, [tasks, isQueuePaused, pumpQueue]);

  const handleRetryTask = (taskId: string) => {
    claimedTaskIdsRef.current.delete(taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'pending', error: undefined } : t))
    );
  };

  const processBatchFiles = useCallback(
    (files: FileList | File[]) => {
      const newTasks: ProcessingTask[] = [];
      for (const f of Array.from(files) as File[]) {
        if (!f.type.startsWith('image/')) continue;
        const id = crypto.randomUUID();
        filesMap.current.set(id, f);
        const previewUrl = URL.createObjectURL(f);
        newTasks.push({
          id,
          fileName: f.name,
          status: 'pending',
          progress: 0,
          batchIndex: 1,
          previewUrl,
        });
      }
      setTasks((prev) => [...prev, ...newTasks]);
    },
    [setTasks, filesMap]
  );

  return {
    isProcessing,
    isQueuePaused,
    setIsQueuePaused,
    handleRetryTask,
    processBatchFiles,
  };
};
