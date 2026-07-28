import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import VirtualTryOn from '@/components/fashion/VirtualTryOn';
import { Sparkles, Loader2 } from 'lucide-react';
import { FashionOutfit } from '@/lib/types';

interface OutfitCardProps {
  name: string;
  description: string;
  imageUrl: string;
  onTryOn: () => void;
}

const OutfitCard = ({ name, description, imageUrl, onTryOn }: OutfitCardProps) => (
  <Card className="overflow-hidden h-full flex flex-col">
    <div className="h-48 overflow-hidden relative group">
      <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <Button
          onClick={onTryOn}
          variant="secondary"
          size="sm"
          className="bg-white/90 hover:bg-white text-black"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Try It On
        </Button>
      </div>
    </div>
    <CardContent className="p-4 flex-grow">
      <h3 className="font-semibold text-lg">{name}</h3>
      <p className="text-muted-foreground text-sm mt-1">{description}</p>
    </CardContent>
    <CardFooter className="p-4 pt-0">
      <Button
        onClick={onTryOn}
        variant="outline"
        className="w-full"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Virtual Try-On
      </Button>
    </CardFooter>
  </Card>
);

export default function Recommendations() {
  const [selectedOutfit, setSelectedOutfit] = useState<{
    name: string;
    imageUrl: string;
  } | null>(null);
  const [isTryOnOpen, setIsTryOnOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<FashionOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch recommendations from fashion-mnist dataset
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/recommendations?limit=12');
        if (!response.ok) {
          throw new Error('Failed to fetch recommendations');
        }
        
        const data = await response.json();
        if (data.success && data.outfits) {
          setRecommendations(data.outfits);
          console.log(`Loaded ${data.outfits.length} items from Fashion-MNIST dataset`);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  const handleTryOn = (outfit: FashionOutfit) => {
    setSelectedOutfit({
      name: outfit.name,
      imageUrl: outfit.imageUrl,
    });
    setIsTryOnOpen(true);
  };
  
  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Your Outfit Recommendations</h1>
      <p className="text-muted-foreground mb-6">
        Personalized outfit suggestions from the Fashion-MNIST dataset based on your style preferences.
      </p>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-muted-foreground">Loading fashion items from dataset...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-semibold">Error loading recommendations</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No recommendations available at the moment.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map(outfit => (
              <OutfitCard 
                key={outfit.id}
                name={outfit.name}
                description={outfit.description}
                imageUrl={outfit.imageUrl}
                onTryOn={() => handleTryOn(outfit)}
              />
            ))}
          </div>

          {selectedOutfit && (
            <VirtualTryOn
              open={isTryOnOpen}
              onOpenChange={setIsTryOnOpen}
              productImageUrl={selectedOutfit.imageUrl}
              productName={selectedOutfit.name}
            />
          )}
        </>
      )}
    </div>
  );
}