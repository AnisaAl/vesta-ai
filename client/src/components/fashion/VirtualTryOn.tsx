import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, X } from 'lucide-react';

interface VirtualTryOnProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productImageUrl: string;
  productName: string;
}

type VtoMode = 'overlay' | 'hosted' | 'python';

export default function VirtualTryOn({ open, onOpenChange, productImageUrl, productName }: VirtualTryOnProps) {
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userPhotoFile, setUserPhotoFile] = useState<File | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<VtoMode | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<VtoMode>('overlay');
  const [hostedConfigured, setHostedConfigured] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLive = provider === 'hosted' && hostedConfigured;

  useEffect(() => {
    if (!open) return;
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        if (data.vtoProvider === 'hosted' || data.vtoProvider === 'python' || data.vtoProvider === 'overlay') {
          setProvider(data.vtoProvider);
        }
        setHostedConfigured(Boolean(data.vtoHostedConfigured));
      })
      .catch(() => {
        setProvider('overlay');
      });
  }, [open]);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size should be less than 10MB');
        return;
      }

      setError(null);
      setUserPhotoFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setUserPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTryOn = async () => {
    if (!userPhotoFile || !productImageUrl) {
      setError('Please upload your photo first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResultImage(null);
    setResultMode(null);

    try {
      const userPhotoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(userPhotoFile);
      });

      let productImageBase64 = productImageUrl;

      if (productImageUrl.startsWith('http://') || productImageUrl.startsWith('https://') ||
          productImageUrl.startsWith('/')) {
        const imageUrl = productImageUrl.startsWith('/')
          ? `${window.location.origin}${productImageUrl}`
          : productImageUrl;

        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) {
          throw new Error(`Could not load the garment image (${imgResponse.status}). Try another look.`);
        }

        const blob = await imgResponse.blob();
        productImageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else if (productImageUrl.startsWith('data:')) {
        productImageBase64 = productImageUrl.split(',')[1];
      }

      const response = await fetch('/api/virtual-try-on', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPhoto: userPhotoBase64,
          productImage: productImageBase64,
          productName: productName,
        }),
      });

      const data = await response.json().catch(() => ({ message: 'Failed to process virtual try-on' }));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to process virtual try-on');
      }

      if (data.resultImage) {
        setResultImage(`data:image/png;base64,${data.resultImage}`);
        if (data.mode === 'hosted' || data.mode === 'python' || data.mode === 'overlay') {
          setResultMode(data.mode);
        }
      } else {
        throw new Error('No result image received');
      }
    } catch (err) {
      console.error('Virtual try-on error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process virtual try-on. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setUserPhoto(null);
    setUserPhotoFile(null);
    setResultImage(null);
    setResultMode(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const liveNow = resultMode === 'hosted' || (isLive && !resultMode);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{liveNow ? 'Live try-on' : 'Virtual Try-On (Demo)'}</DialogTitle>
          <DialogDescription>
            {liveNow
              ? `Generate a garment-on-person preview of ${productName}. Your photo is sent to the hosted try-on provider.`
              : `Demo overlay — not a production fit. Upload a photo to see an approximate composite of ${productName}.`}
          </DialogDescription>
        </DialogHeader>

        {liveNow ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 mb-2">
            Live try-on: the photo is processed by a third-party model (Replicate). Do not upload photos you do not want sent off this machine.
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 mb-2">
            Demo mode: simple overlay. Set VTO_PROVIDER=hosted and REPLICATE_API_TOKEN for Live garment-on-person results.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-2">Product</h3>
            <div className="w-full aspect-square border rounded-lg overflow-hidden bg-gray-100">
              <img
                src={productImageUrl}
                alt={productName}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-2">Your Photo</h3>
            {userPhoto ? (
              <div className="relative w-full aspect-square border rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={userPhoto}
                  alt="Your photo"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="w-full aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label
                  htmlFor="photo-upload"
                  className="flex flex-col items-center justify-center cursor-pointer w-full h-full"
                >
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600 text-center px-4">
                    Click to upload your photo
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-2">Result</h3>
            <div className="w-full aspect-square border rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Processing...</span>
                </div>
              ) : resultImage ? (
                <img
                  src={resultImage}
                  alt="Virtual try-on result"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm text-gray-400 text-center px-4">
                  Result will appear here
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            <p className="font-semibold mb-2">Try-on could not finish</p>
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button
            onClick={handleTryOn}
            disabled={!userPhoto || isProcessing}
            className="min-w-[120px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Try It On'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
