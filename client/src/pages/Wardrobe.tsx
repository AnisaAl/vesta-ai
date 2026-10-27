import React, { useEffect, useRef, useState } from 'react';
import { Upload, Plus, Trash2 } from 'lucide-react';
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
import { useWardrobe, type WardrobeTag } from '@/hooks/useWardrobe';

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
  const { items, isLoading, isError, upload, removeItem } = useWardrobe();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

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
    if (pendingFile) {
      // Focus after dialog opens
      const t = window.setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 50);
      return () => window.clearTimeout(t);
    }
  }, [pendingFile]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setPendingFile(file);
      setPendingTitle(titleFromFilename(file.name));
    }
    // Allow re-selecting the same file
    event.target.value = '';
  };

  const closeNameDialog = () => {
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Wardrobe</h1>
          <p className="text-muted-foreground">
            Upload clothing you own. Name each piece before it is saved — chat can reference those titles.
            Closet pieces are never sold — shopping stays on the affiliate catalog.
          </p>
        </div>

        <div className="mb-8 p-6 border-2 border-dashed border-muted rounded-lg bg-muted/20">
          <div className="text-center">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Add New Items</h3>
            <p className="text-muted-foreground mb-4">
              Upload an image, then give it a name before it appears in your wardrobe
            </p>
            <div className="flex justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="sr-only"
                id="wardrobe-file-upload"
                disabled={upload.isPending || Boolean(pendingFile)}
              />
              <Button asChild disabled={upload.isPending || Boolean(pendingFile)}>
                <label
                  htmlFor="wardrobe-file-upload"
                  className={`cursor-pointer inline-flex items-center ${
                    upload.isPending || pendingFile ? 'pointer-events-none opacity-50' : ''
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
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                      <Badge className={getTagColor(item.tag)}>{item.tag}</Badge>
                    </div>
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
                  disabled={upload.isPending || Boolean(pendingFile)}
                />
                <Button asChild disabled={upload.isPending || Boolean(pendingFile)}>
                  <label
                    htmlFor="wardrobe-empty-upload"
                    className={`cursor-pointer inline-flex items-center ${
                      upload.isPending || pendingFile ? 'pointer-events-none opacity-50' : ''
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

      <Dialog
        open={Boolean(pendingFile)}
        onOpenChange={(open) => {
          if (!open) closeNameDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name this piece</DialogTitle>
            <DialogDescription>
              Choose a clear name before it is saved to your wardrobe. Chat can use this title later.
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
              ref={titleInputRef}
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
              onClick={closeNameDialog}
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
    </div>
  );
}
