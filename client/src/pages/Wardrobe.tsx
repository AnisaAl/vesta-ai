import React from 'react';
import { Upload, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function Wardrobe() {
  const { items, isLoading, isError, upload, removeItem } = useWardrobe();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      upload.mutate({ file: files[0], tag: 'other' as WardrobeTag });
    }
    // Allow re-selecting the same file
    event.target.value = '';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Wardrobe</h1>
          <p className="text-muted-foreground">
            Upload clothing you own. Items persist across refresh and can be referenced in chat.
            Closet pieces are never sold — shopping stays on the affiliate catalog.
          </p>
        </div>

        <div className="mb-8 p-6 border-2 border-dashed border-muted rounded-lg bg-muted/20">
          <div className="text-center">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Add New Items</h3>
            <p className="text-muted-foreground mb-4">
              Upload images of your clothing items to build your digital wardrobe
            </p>
            <div className="flex justify-center">
              {/*
                Native <label htmlFor> — same pattern as VirtualTryOn.
                Programmatic input.click() on display:none inputs is unreliable
                in some browsers / Docker-served production builds.
              */}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="sr-only"
                id="wardrobe-file-upload"
                disabled={upload.isPending}
              />
              <Button asChild disabled={upload.isPending}>
                <label
                  htmlFor="wardrobe-file-upload"
                  className={`cursor-pointer inline-flex items-center ${
                    upload.isPending ? 'pointer-events-none opacity-50' : ''
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
                  disabled={upload.isPending}
                />
                <Button asChild disabled={upload.isPending}>
                  <label
                    htmlFor="wardrobe-empty-upload"
                    className={`cursor-pointer inline-flex items-center ${
                      upload.isPending ? 'pointer-events-none opacity-50' : ''
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
    </div>
  );
}
