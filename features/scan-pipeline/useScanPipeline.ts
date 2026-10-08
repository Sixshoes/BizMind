
import { useState, useCallback, useRef, useEffect } from 'react';
import { BusinessCardData, ProcessingTask } from '../../types';
import { compressImage } from '../../utils/imageUtils';
import { extractCardInfo } from '../../services/geminiService';
import { uploadImageAsset } from '../../utils/firebase';
import { saveCardToDB, deleteCardFromDB } from '../../services/dbService';

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
  const tasksRef = useRef<ProcessingTask[]>(tasks);
  const pausedRef = useRef(isQueuePaused);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { pausedRef.current = isQueuePaused; }, [isQueuePaused]);

  const performSingleTask = async (task: ProcessingTask) => {
    try {
        const fileObj = filesMap.current.get(task.id);
        if (!fileObj) throw new Error("File missing from memory");

        const duplicateFile = cardsRef.current.find(c => 
            c.originalFileName === (fileObj as any).name && c.originalFileSize === fileObj.size
        );

        if (duplicateFile) {
            const action = await new Promise<'process' | 'skip'>((resolve) => {
                setDuplicateFilePrompt({
                    fileName: (fileObj as any).name || 'unknown',
                    resolve
                });
            });
            setDuplicateFilePrompt(null);
            if (action === 'skip') {
                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t));
                filesMap.current.delete(task.id);
                setTimeout(() => setTasks(prev => prev.filter(t => t.id !== task.id)), 1500);
                return;
            }
        }

        const processWithTimeout = async () => {
            const base64Data = await compressImage(fileObj);
            const info = await extractCardInfo(base64Data, 'image/jpeg');
            return { base64Data, info };
        };

        const timeoutPromise = new Promise<{base64Data: string, info: any}>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout (45s)")), 45000)
        );

        const { base64Data, info } = await Promise.race([processWithTimeout(), timeoutPromise]);

        let imageUrl = `data:image/jpeg;base64,${base64Data}`;
        let imageId: string | undefined = undefined;
        try {
            const uploadResult = await uploadImageAsset(imageUrl, task.id);
            imageUrl = uploadResult.downloadUrl;
            imageId = uploadResult.imageId;
        } catch (e) {
            console.error("Firebase upload failed during scan", e);
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
            imageUrl: imageUrl,
            imageId: imageId,
            originalFileName: (fileObj as any).name,
            originalFileSize: fileObj.size,
            syncStatus: imageUrl.startsWith('http') ? 'firebase' : 'local', // Set sync status
        };

        // Robust similarity / duplicate check
        let similarityReason = "";
        const duplicate = cardsRef.current.find(c => {
            // 1. Check exact email match
            if (c.email && newCard.email && c.email.trim().toLowerCase() === newCard.email.trim().toLowerCase()) {
                similarityReason = `電子郵件相同 (${c.email})`;
                return true;
            }

            // 2. Check phone/mobile match (clean numbers, minimum 8 digits to avoid false matching short codes)
            const cleanPhone = (p: string) => p.replace(/\D/g, '');
            const cPhone = cleanPhone(c.phone || '');
            const newPhone = cleanPhone(newCard.phone || '');
            if (cPhone && newPhone && cPhone.length >= 8 && cPhone === newPhone) {
                similarityReason = `電話號碼相同 (${c.phone})`;
                return true;
            }

            // 3. Name + Company comparison
            const cFullName = `${c.lastName || ''}${c.firstName || ''}`.trim().toLowerCase();
            const newFullName = `${newCard.lastName || ''}${newCard.firstName || ''}`.trim().toLowerCase();
            const cComp = (c.company || '').trim().toLowerCase();
            const newComp = (newCard.company || '').trim().toLowerCase();

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

            // 4. Fuzzy Name + Company matching (e.g. partial overlapping names and company names)
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
                filesMap.current.delete(task.id);
                setTimeout(() => setTasks(prev => prev.filter(t => t.id !== task.id)), 1500);
                return;
            } else if (action === 'replace') {
                await deleteCardFromDB(duplicate.id);
                setCards(prev => prev.filter(c => c.id !== duplicate.id));
            }
        }

        await saveCardToDB(newCard);
        setCards(prev => [newCard, ...prev].sort((a,b) => b.scannedAt - a.scannedAt));
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t));
        filesMap.current.delete(task.id);
        setTimeout(() => setTasks(prev => prev.filter(t => t.id !== task.id)), 1500);

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
  };

  const processQueue = useCallback(async () => {
    if (processingMutex.current || pausedRef.current) return;
    processingMutex.current = true;
    setIsProcessing(true);
    try {
        while (true) {
            if (pausedRef.current) break;
            const nextTask = tasksRef.current.find(t => t.status === 'pending');
            if (!nextTask) break;
            setTasks(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'processing' } : t));
            await performSingleTask(nextTask);
            await new Promise(r => setTimeout(r, 500));
        }
    } finally {
        processingMutex.current = false;
        setIsProcessing(false);
    }
  }, [setTasks, performSingleTask]);

  useEffect(() => {
    if (!isQueuePaused && !isProcessing) {
        processQueue();
    }
  }, [tasks, isQueuePaused, isProcessing, processQueue]);

  const handleRetryTask = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pending', error: undefined } : t));
  };

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
