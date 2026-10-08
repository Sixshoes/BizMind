
import { useState, useEffect, useRef, useCallback } from 'react';
import { BusinessCardData, ProcessingTask } from '../types';
import { getCardsMetadataFromDB, getCardById, saveCardToDB, deleteCardFromDB, clearAllCardsFromDB } from '../services/dbService';

export const useCardState = () => {
  const [cards, setCards] = useState<BusinessCardData[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BusinessCardData | null>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [tasks, setTasks] = useState<ProcessingTask[]>([]);
  
  const cardsRef = useRef<BusinessCardData[]>([]);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // Load initial cards from DB
  const loadCards = useCallback(async () => {
    const data = await getCardsMetadataFromDB();
    setCards(data.sort((a,b) => b.scannedAt - a.scannedAt));
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Handle Card Selection
  const selectCard = useCallback(async (id: string | null) => {
    setSelectedCardId(id);
    if (id) {
      const data = await getCardById(id);
      if (data) {
        setFormData(data);
        setIsFormDirty(false);
      }
    } else {
      setFormData(null);
      setIsFormDirty(false);
    }
  }, []);

  const updateCardInList = useCallback((updatedCard: BusinessCardData) => {
    setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
  }, []);

  const removeCardFromList = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const addCardToList = useCallback((newCard: BusinessCardData) => {
    setCards(prev => [newCard, ...prev].sort((a,b) => b.scannedAt - a.scannedAt));
  }, []);

  return {
    cards,
    setCards,
    cardsRef,
    selectedCardId,
    setSelectedCardId,
    selectCard,
    formData,
    setFormData,
    isFormDirty,
    setIsFormDirty,
    tasks,
    setTasks,
    loadCards,
    updateCardInList,
    removeCardFromList,
    addCardToList
  };
};
