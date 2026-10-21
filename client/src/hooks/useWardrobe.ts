import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export type WardrobeTag = 'casual' | 'business' | 'colorful' | 'festive' | 'other';

export interface WardrobeItemDto {
  id: number;
  sessionId: string;
  userId: number | null;
  title: string;
  imageKey: string;
  imageUrl: string;
  category: string;
  tag: WardrobeTag | string;
  colors: string[];
  createdAt: string;
  updatedAt: string;
}

const WARDROBE_KEY = ['/api/wardrobe'];

async function fetchWardrobe(): Promise<WardrobeItemDto[]> {
  const res = await fetch('/api/wardrobe', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load wardrobe');
  const data = await res.json();
  return data.items as WardrobeItemDto[];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function useWardrobe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery({
    queryKey: WARDROBE_KEY,
    queryFn: fetchWardrobe,
  });

  const upload = useMutation({
    mutationFn: async (input: {
      file: File;
      title?: string;
      tag?: WardrobeTag;
    }) => {
      const imageData = await fileToDataUrl(input.file);
      const title =
        input.title ||
        input.file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() ||
        'Wardrobe item';
      const res = await apiRequest('POST', '/api/wardrobe', {
        imageData,
        title,
        tag: input.tag || 'other',
      });
      return res.json();
    },
    onSuccess: (payload) => {
      queryClient.setQueryData(WARDROBE_KEY, (prev: WardrobeItemDto[] | undefined) => [
        payload.item as WardrobeItemDto,
        ...(prev || []),
      ]);
      toast({ title: 'Added to wardrobe' });
    },
    onError: () => toast({ title: 'Could not upload item', variant: 'destructive' }),
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: number;
      title?: string;
      tag?: WardrobeTag;
      category?: string;
    }) => {
      const res = await apiRequest('PATCH', `/api/wardrobe/${id}`, patch);
      return res.json();
    },
    onSuccess: (payload) => {
      queryClient.setQueryData(WARDROBE_KEY, (prev: WardrobeItemDto[] | undefined) =>
        (prev || []).map((item) =>
          item.id === payload.item.id ? (payload.item as WardrobeItemDto) : item
        )
      );
    },
    onError: () => toast({ title: 'Could not update item', variant: 'destructive' }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/wardrobe/${id}`);
      return res.json();
    },
    onSuccess: (payload) => {
      queryClient.setQueryData(WARDROBE_KEY, (prev: WardrobeItemDto[] | undefined) =>
        (prev || []).filter((item) => item.id !== payload.item.id)
      );
      toast({ title: 'Removed from wardrobe' });
    },
    onError: () => toast({ title: 'Could not remove item', variant: 'destructive' }),
  });

  return {
    items: data ?? [],
    isLoading,
    isError,
    upload,
    updateItem,
    removeItem,
  };
}
