import { useState, useCallback, useRef, useEffect } from 'react';
import { BusinessCardData, ProcessingTask } from '../../types';
import { compressImageWithMime } from '../../utils/imageUtils';
import { extractCardInfo } from '../../services/geminiService';
import { uploadImageAsset } from '../../utils/firebase';
import { saveCardToDB, deleteCardFromDB } from '../../services/dbService';

const SCAN_CONCURRENCY = 3;

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
  const processingMutex = useRef(false);
  const inFlightIds = useRef<Set<string>>(new Set());
  const promptMutex = useRef<Promise<void>>(Promise.resolve());
  const tasksRef = useRef<ProcessingTask[]>(tasks);
  const pausedRef = useRef(isQueuePaused);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { pausedRef.current = isQueuePaused; }, [isQueuePaused]);

  // Serialize interactive modal prompts across concurrent workers
  const withPromptLock = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = promptMutex.current.then(fn, fn);
    promptMutex.current = next.then(() => undefined, () => undefined);
    return next;
  }, []);

  const cleanupFinishedTask = useCallback((task: ProcessingTask) => {
    filesMap.current.delete(task.id);
    setTimeout(() => {
      if (task.previewUrl && task.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(task.previewUrl);
      }
      setTasks(prev => prev.filter(t => t.id !== task.id));
    }, 1500);
  }, [filesMap, setTasks]);

  const performSingleTask = useCallback(async (task: ProcessingTask) => {
    try {
      const fileObj = filesMap.current.get(task.id);
      if (!fileObj) throw new Error("File missing from memory");

      const fileName = (fileObj as any).name;
      if (fileName) {
        const duplicateFile = cardsRef.current.find(c =>
          c.originalFileName === fileName && c.originalFileSize === fileObj.size
        );

        if (duplicateFile) {
          const action = await withPromptLock(async () => {
            const res = await new Promise<'process' | 'skip'>((resolve) => {
              setDuplicateFilePrompt({
                fileName: fileName || 'unknown',
                resolve
              });
            });
            setDuplicateFilePrompt(null);
            return res;
          });

          if (action === 'skip') {
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t));
            cleanupFinishedTask(task);
            return;
          }
        }
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Timeout (45s)")), 45000);
      });

      const processAndUpload = async () => {
        const { base64: base64Data, mimeType } = await compressImageWithMime(fileObj);
        const localDataUrl = `data:${mimeType};base64,${base64Data}`;

        // Run Gemini OCR and Firebase image upload concurrently
        const [info, uploadResult] = await Promise.all([
          extractCardInfo(base64Data, mimeType),
          uploadImageAsset(localDataUrl, task.id).catch((e) => {
            console.error("Firebase upload failed during scan", e);
            return null;
          })
        ]);

        return {
          info,
          imageUrl: uploadResult?.downloadUrl || localDataUrl,
          imageId: uploadResult?.imageId,
        };
      };

      let info: any;
      let imageUrl: string;
      let imageId: string | undefined;
      try {
        const result = await Promise.race([processAndUpload(), timeoutPromise]);
        info = result.info;
        imageUrl = result.imageUrl;
        imageId = result.imageId;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      const newCard: BusinessCardData = {
        notes: '',
        prefix: '',
        fax: '',
        summary: '',
        reasoning: '',
        ...info,
        id: task.id,
        scannedAt: Date.now(),
        source: 'EcoScan',
        imageUrl,
        imageId,
        originalFileName: fileName,
        originalFileSize: fileObj.size,
        syncStatus: imageUrl.startsWith('http') ? 'firebase' : 'local',
      };

      // Serialize duplicate check + insertion so concurrent workers see up-to-date cardsRef
      await withPromptLock(async () => {
        let similarityReason = "";
        const cleanPhone = (p: string) => p.replace(/\D/g, '');
        const newPhone = cleanPhone(newCard.phone || '');
        const newFullName = `${newCard.lastName || ''}${newCard.firstName || ''}`.trim().toLowerCase();
        const newComp = (newCard.company || '').trim().toLowerCase();
        const newEmail = newCard.email?.trim().toLowerCase() || '';

        const duplicate = cardsRef.current.find(c => {
          if (c.email && newEmail && c.email.trim().toLowerCase() === newEmail) {
            similarityReason = `電子郵件相同 (${c.email})`;
            return true;
          }

          const cPhone = cleanPhone(c.phone || '');
          if (cPhone && newPhone && cPhone.length >= 8 && cPhone === newPhone) {
            similarityReason = `電話號碼相同 (${c.phone})`;
            return true;
          }

          const cFullName = `${c.lastName || ''}${c.firstName || ''}`.trim().toLowerCase();
          const cComp = (c.company || '').trim().toLowerCase();

          if (cFullName && newFullName && cFullName === newFullName) {
            if (cComp === newComp && cComp !== '') {
              similarityReason = `姓名與公司名稱完全相同`;
              return true;
            }
            if (cComp === '' || newComp === '' || cComp.includes(newComp) || newComp.includes(cComp)) {
              similarityReason = `姓名相同 (${cFullName})，且公司相似或其中一方未填寫`;
              return true;
            }
          }

          if (cFullName && newFullName && cFullName.length >= 2 && newFullName.length >= 2) {
            const namesIntersect = cFullName.includes(newFullName) || newFullName.includes(cFullName);
            const companyIntersect = cComp && newComp && (cComp.includes(newComp) || newComp.includes(cComp));
            if (namesIntersect && companyIntersect) {
              similarityReason = `姓名與公司名稱高度相似`;
              return true;
            }
          }

          return false;
        });

        if (duplicate) {
          const action = await new Promise<'replace' | 'keep' | 'discard'>((resolve) => {
            setDuplicatePrompt({
              newCard,
              oldCard: duplicate,
              reason: similarityReason,
              resolve
            });
          });
          setDuplicatePrompt(null);

          if (action === 'discard') {
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t));
            cleanupFinishedTask(task);
            return;
          } else if (action === 'replace') {
            await deleteCardFromDB(duplicate.id);
            cardsRef.current = cardsRef.current.filter(c => c.id !== duplicate.id);
            setCards(prev => prev.filter(c => c.id !== duplicate.id));
          }
        }

        await saveCardToDB(newCard);
        cardsRef.current = [newCard, ...cardsRef.current];
        setCards(prev => [newCard, ...prev].sort((a, b) => b.scannedAt - a.scannedAt));
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t));
        cleanupFinishedTask(task);
      });

    } catch (err: any) {
      console.error(`Task ${task.id} Failed:`, err);
      let errorMsg = err.message || "處理失敗";
      if (errorMsg.includes('spending cap') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
        errorMsg = "AI 專案預算上限已達 (429)";
      } else if (errorMsg.includes('Timeout')) {
        errorMsg = "AI 回應超時";
      } else if (errorMsg.includes('500') || errorMsg.includes('Internal')) {
        errorMsg = "伺服器錯誤 (500)";
      }
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error', error: errorMsg } : t));
    }
  }, [cardsRef, cleanupFinishedTask, filesMap, setCards, setDuplicateFilePrompt, setDuplicatePrompt, setTasks, withPromptLock]);

  const processQueue = useCallback(async () => {
    if (processingMutex.current || pausedRef.current) return;
    const hasPending = tasksRef.current.some(t => t.status === 'pending' && !inFlightIds.current.has(t.id));
    if (!hasPending) return;

    processingMutex.current = true;
    setIsProcessing(true);

    const claimNextTask = (): ProcessingTask | undefined => {
      if (pausedRef.current) return undefined;
      const next = tasksRef.current.find(t => t.status === 'pending' && !inFlightIds.current.has(t.id));
      if (!next) return undefined;
      inFlightIds.current.add(next.id);
      tasksRef.current = tasksRef.current.map(t => t.id === next.id ? { ...t, status: 'processing' } : t);
      setTasks(prev => prev.map(t => t.id === next.id ? { ...t, status: 'processing' } : t));
      return next;
    };

    const runWorker = async () => {
      while (!pausedRef.current) {
        const nextTask = claimNextTask();
        if (!nextTask) break;
        try {
          await performSingleTask(nextTask);
        } finally {
          inFlightIds.current.delete(nextTask.id);
        }
      }
    };

    try {
      while (!pausedRef.current) {
        const pendingCount = tasksRef.current.filter(t => t.status === 'pending' && !inFlightIds.current.has(t.id)).length;
        if (pendingCount === 0) break;
        const workerCount = Math.min(SCAN_CONCURRENCY, pendingCount);
        await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
      }
    } finally {
      processingMutex.current = false;
      setIsProcessing(false);
    }
  }, [performSingleTask, setTasks]);

  useEffect(() => {
    if (!isQueuePaused && !isProcessing) {
      processQueue();
    }
  }, [tasks, isQueuePaused, isProcessing, processQueue]);

  const handleRetryTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pending', error: undefined } : t));
  }, [setTasks]);

  const processBatchFiles = useCallback((files: FileList | File[]) => {
    const newTasks: ProcessingTask[] = [];
    for (const f of Array.from(files) as File[]) {
      if (!f.type.startsWith('image/')) continue;
      const id = crypto.randomUUID();
      filesMap.current.set(id, f);
      const previewUrl = URL.createObjectURL(f);
      newTasks.push({ id, fileName: f.name, status: 'pending', progress: 0, batchIndex: 1, previewUrl });
    }
    setTasks(prev => [...prev, ...newTasks]);
  }, [setTasks, filesMap]);

  return {
    isProcessing,
    isQueuePaused,
    setIsQueuePaused,
    handleRetryTask,
    processBatchFiles
  };
};
