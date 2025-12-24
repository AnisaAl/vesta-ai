import React, { useState } from 'react';
import { Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface WardrobeItem {
  id: string;
  title: string;
  imageUrl: string;
  tag: 'casual' | 'business' | 'colorful' | 'festive' | 'other';
}

export function Wardrobe() {
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([
    {
      id: '1',
      title: 'Classic White T-Shirt',
      imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
      tag: 'casual'
    },
    {
      id: '2',
      title: 'Navy Blue Blazer',
      imageUrl: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&h=400&fit=crop',
      tag: 'business'
    }
  ]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const imageUrl = URL.createObjectURL(file);
      
      const newItem: WardrobeItem = {
        id: Date.now().toString(),
        title: `Uploaded Item ${wardrobeItems.length + 1}`,
        imageUrl,
        tag: 'other'
      };
      
      setWardrobeItems([...wardrobeItems, newItem]);
    }
  };

  const getTagColor = (tag: string) => {
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
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Wardrobe</h1>
          <p className="text-muted-foreground">
            Upload and organize your clothing items to get personalized fashion recommendations.
          </p>
        </div>

        {/* Upload Section */}
        <div className="mb-8 p-6 border-2 border-dashed border-muted rounded-lg bg-muted/20">
          <div className="text-center">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Add New Items</h3>
            <p className="text-muted-foreground mb-4">
              Upload images of your clothing items to build your digital wardrobe
            </p>
            <div className="flex justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button className="cursor-pointer">
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Images
                </Button>
              </label>
            </div>
          </div>
        </div>

        {/* Wardrobe Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wardrobeItems.map((item) => (
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
              <div className="p-4">
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <Badge className={getTagColor(item.tag)}>
                  {item.tag}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {wardrobeItems.length === 0 && (
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
              className="hidden"
              id="empty-upload"
            />
            <label htmlFor="empty-upload">
              <Button className="cursor-pointer">
                <Plus className="w-4 h-4 mr-2" />
                Upload Your First Item
              </Button>
            </label>
          </div>
        )}
      </div>
    </div>
  );
} 