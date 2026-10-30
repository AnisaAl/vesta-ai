import React, { useEffect, useRef, useState } from 'react';
import { Upload, Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWardrobe, type WardrobeItemDto, type WardrobeTag } from '@/hooks/useWardrobe';

function getTagColor(tag: string) {
  switch (tag) {
    case 'casual':
      return 'bg-blue-100 text-blue-800';
    case 'business':
      return 'bg-gray-100 text-gray-800';
    case 'colorful':
      return 'bg-pink-100 text-pink-800';
    case 'festive':
      return 'bg-yellow-100 text-yellow-800';
    case 'other':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Wardrobe item';
}

export function Wardrobe() {
  const { items, isLoading, isError, upload, updateItem, removeItem } = useWardrobe();

  // Name-before-save (new upload)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState('');
  const uploadTitleRef = useRef<HTMLInputElement>(null);

  // Rename existing item
  const [renamingItem, setRenamingItem] = useState<WardrobeItemDto | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const renameTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  useEffect(() => {
    if (!pendingFile) return;
    const t = window.setTimeout(() => {
      uploadTitleRef.current?.focus();
      uploadTitleRef.current?.select();
    }, 50);
    return () => window.clearTimeout(t);
  }, [pendingFile]);

  useEffect(() => {
    if (!renamingItem) return;
    const t = window.setTimeout(() => {
      renameTitleRef.current?.focus();
      renameTitleRef.current?.select();
    }, 50);
    return () => window.clearTimeout(t);
  }, [renamingItem]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setPendingFile(file);
      setPendingTitle(titleFromFilename(file.name));
    }
    event.target.value = '';
  };

  const closeUploadDialog = () => {
    if (upload.isPending) return;
    setPendingFile(null);
    setPendingTitle('');
  };

  const confirmUpload = () => {
    if (!pendingFile) return;
    const title = pendingTitle.trim() || titleFromFilename(pendingFile.name);
    upload.mutate(
      { file: pendingFile, title, tag: 'other' as WardrobeTag },
      {
        onSuccess: () => {
          setPendingFile(null);
          setPendingTitle('');
        },
      }
    );
  };

  const openRename = (item: WardrobeItemDto) => {
    setRenamingItem(item);
    setRenameTitle(item.title);
  };

  const closeRename = () => {
    if (updateItem.isPending) return;
    setRenamingItem(null);
    setRenameTitle('');
  };

  const confirmRename = () => {
    if (!renamingItem) return;
    const title = renameTitle.trim();
    if (!title || title === renamingItem.title) {
      closeRename();
      return;
    }
    updateItem.mutate(
      { id: renamingItem.id, title },
      {
        onSuccess: () => {
          setRenamingItem(null);
          setRenameTitle('');
        },
      }
    );
  };

  const busy = upload.isPending || updateItem.isPending || Boolean(pendingFile);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Wardrobe</h1>
          <p className="text-muted-foreground">
            Upload clothing you own. Name each new piece before it is saved, or rename any card later.
            Closet pieces are never sold — shopping stays on the affiliate catalog.
          </p>
        </div>

        <div className="mb-8 p-6 border-2 border-dashed border-muted rounded-lg bg-muted/20">
          <div className="text-center">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Add New Items</h3>
            <p className="text-muted-foreground mb-4">
              Choose a photo, then set the name in the dialog before it appears below
            </p>
            <div className="flex justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="sr-only"
                id="wardrobe-file-upload"
                disabled={busy}
              />
              <Button asChild disabled={busy}>
                <label
                  htmlFor="wardrobe-file-upload"
                  className={`cursor-pointer inline-flex items-center ${
                    busy ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {upload.isPending ? 'Uploading…' : 'Upload Images'}
                </label>
              </Button>
            </div>
          </div>
        </div>

        {isError && (
          <p className="text-sm text-destructive mb-4">
            Could not load wardrobe. Check that the API and database are running.
          </p>
        )}

        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">Loading wardrobe…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-card border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground mb-2 truncate">{item.title}</h3>
                      <Badge className={getTagColor(item.tag)}>{item.tag}</Badge>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Rename ${item.title}`}
                        disabled={updateItem.isPending || removeItem.isPending}
                        onClick={() => openRename(item)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${item.title}`}
                        disabled={removeItem.isPending}
                        onClick={() => removeItem.mutate(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {items.length === 0 && (
              <div className="text-center py-12">
                <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Your wardrobe is empty</h3>
                <p className="text-muted-foreground mb-6">
                  Start by uploading some clothing items to get personalized recommendations
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                  id="wardrobe-empty-upload"
                  disabled={busy}
                />
                <Button asChild disabled={busy}>
                  <label
                    htmlFor="wardrobe-empty-upload"
                    className={`cursor-pointer inline-flex items-center ${
                      busy ? 'pointer-events-none opacity-50' : ''
                    }`}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Your First Item
                  </label>
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Name new upload before it is saved */}
      <Dialog
        open={Boolean(pendingFile)}
        onOpenChange={(open) => {
          if (!open) closeUploadDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name this piece</DialogTitle>
            <DialogDescription>
              Set a clear name before it is saved to your wardrobe. You can rename it again later.
            </DialogDescription>
          </DialogHeader>

          {pendingPreviewUrl && (
            <div className="mx-auto w-40 aspect-square overflow-hidden rounded-md border bg-muted">
              <img
                src={pendingPreviewUrl}
                alt="Upload preview"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="wardrobe-item-title">Name</Label>
            <Input
              id="wardrobe-item-title"
              ref={uploadTitleRef}
              value={pendingTitle}
              onChange={(e) => setPendingTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Navy blazer"
              disabled={upload.isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmUpload();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeUploadDialog}
              disabled={upload.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmUpload}
              disabled={upload.isPending || !pendingTitle.trim()}
            >
              {upload.isPending ? 'Saving…' : 'Add to wardrobe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename an existing card */}
      <Dialog
        open={Boolean(renamingItem)}
        onOpenChange={(open) => {
          if (!open) closeRename();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename item</DialogTitle>
            <DialogDescription>
              Update the name used in your wardrobe and when chat references this piece.
            </DialogDescription>
          </DialogHeader>

          {renamingItem && (
            <div className="mx-auto w-40 aspect-square overflow-hidden rounded-md border bg-muted">
              <img
                src={renamingItem.imageUrl}
                alt={renamingItem.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="wardrobe-rename-title">Name</Label>
            <Input
              id="wardrobe-rename-title"
              ref={renameTitleRef}
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Navy blazer"
              disabled={updateItem.isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmRename();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeRename}
              disabled={updateItem.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmRename}
              disabled={updateItem.isPending || !renameTitle.trim()}
            >
              {updateItem.isPending ? 'Saving…' : 'Save name'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
