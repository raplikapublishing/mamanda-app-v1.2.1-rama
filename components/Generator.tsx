import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Age, FileWithPreview, Gender, AspectRatio } from '../types';
import { GENDER_OPTIONS, AGE_OPTIONS, MAX_PRODUCT_SIZE_BYTES, MAX_LOGO_SIZE_BYTES, ACCEPTED_IMAGE_TYPES, ASPECT_RATIO_OPTIONS } from '../constants';
import { generateEditorialImages } from '../services/geminiService';
import ResultsDisplay from './ResultsDisplay';
import ImagePreviewModal from './ImagePreviewModal';
import Spinner from './ui/Spinner';
import Toast from './ui/Toast';
import { UploadIcon, DownloadIcon, XIcon } from './Icons';

// Sub-component FileInput (tetap sama)
const FileInput: React.FC<{
  id: string;
  label: string;
  description: string;
  file: FileWithPreview | null;
  onFileChange: (file: File | null) => void;
  error?: string;
}> = ({ id, label, description, file, onFileChange, error }) => {
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault();
  
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1">
        <label
          htmlFor={id}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`relative flex justify-center items-center px-6 pt-5 pb-6 border-2 ${error ? 'border-red-400' : 'border-gray-300'} border-dashed rounded-md cursor-pointer hover:border-primary-400 transition-colors duration-200`}
        >
          {file ? (
            <div>
              <img src={file.preview} alt="Preview" className="mx-auto max-h-32 rounded-md" />
              <p className="text-center text-xs text-gray-500 mt-2">{file.name}</p>
            </div>
          ) : (
            <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <span className="relative font-medium text-primary hover:text-primary-600">
                  <span>Upload file</span>
                  <input id={id} name={id} type="file" className="sr-only" onChange={(e) => onFileChange(e.target.files?.[0] || null)} accept={ACCEPTED_IMAGE_TYPES.join(',')} />
                </span>
                <p className="pl-1">atau drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
          )}
        </label>
        {file && (
          <button onClick={() => onFileChange(null)} className="mt-2 text-xs text-red-600 hover:text-red-800">
            Hapus
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
};

declare global {
    interface Window {
        JSZip: any;
    }
}

// Tipe GeneratedBatch (dari Tahap 1)
type GeneratedBatch = {
  productName: string;
  images: string[];
}

const Generator: React.FC = () => {
  // State dari Tahap 1
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [productImages, setProductImages] = useState<FileWithPreview[]>([]);
  const [generatedBatches, setGeneratedBatches] = useState<GeneratedBatch[]>([]);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  
  const [productImage, setProductImage] = useState<FileWithPreview | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // State Bersama
  const [logoImage, setLogoImage] = useState<FileWithPreview | null>(null);
  const [gender, setGender] = useState<Gender>(Gender.Female);
  const [age, setAge] = useState<Age>(Age.YoungAdults);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Portrait);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<{ product?: string; logo?: string }>({});

  // State Modal (dari Tahap 3)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // validateFile (tetap sama)
  const validateFile = (file: File | null, maxSize: number, type: 'product' | 'logo') => {
    if (!file) {
      setFileErrors(prev => ({ ...prev, [type]: `${type === 'product' ? 'Foto produk' : 'Logo'} wajib diunggah.` }));
      return false;
    }
    if (file.size > maxSize) {
      setFileErrors(prev => ({ ...prev, [type]: `Ukuran file maksimal ${maxSize / 1024 / 1024}MB.` }));
      return false;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setFileErrors(prev => ({ ...prev, [type]: `Format file harus JPG atau PNG.` }));
      return false;
    }
    setFileErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[type];
        return newErrors;
    });
    return true;
  };

  // handleFileChange (mode single) (tetap sama)
  const handleFileChange = (setter: React.Dispatch<React.SetStateAction<FileWithPreview | null>>, maxSize: number, type: 'product' | 'logo') => (file: File | null) => {
    if (file) {
      if (validateFile(file, maxSize, type)) {
        setter(Object.assign(file, { preview: URL.createObjectURL(file) }));
      } else {
        setter(null);
      }
    } else {
      setter(null);
      setFileErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[type];
        return newErrors;
    });
    }
  };

  // handleBatchFileChange (dari Tahap 1) (tetap sama)
  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 10);
      const fileErrors: string[] = [];
      
      const validFiles = files.filter((file: File) => {
        if (file.size > MAX_PRODUCT_SIZE_BYTES) {
          fileErrors.push(`${file.name} terlalu besar (Maks 10MB)`);
          return false;
        }
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          fileErrors.push(`${file.name} format tidak valid (JPG/PNG)`);
          return false;
        }
        return true;
      });

      if (fileErrors.length > 0) {
        setError(fileErrors.join(', '));
      }

      const filesWithPreview = validFiles.map((file: File) => 
        Object.assign(file, { preview: URL.createObjectURL(file) })
      );
      setProductImages(filesWithPreview);
    }
    e.target.value = '';
  };

  // removeBatchFile (dari Tahap 1) (tetap sama)
  const removeBatchFile = (fileName: string) => {
    setProductImages(prev => prev.filter(file => file.name !== fileName));
  };
  
  // cleanup (dari Tahap 1) (tetap sama)
  useEffect(() => {
    return () => {
      if (productImage) URL.revokeObjectURL(productImage.preview);
      if (logoImage) URL.revokeObjectURL(logoImage.preview);
      productImages.forEach(file => URL.revokeObjectURL(file.preview));
    };
  }, [productImage, logoImage, productImages]);

  // isFormValid (mode single) (tetap sama)
  const isFormValid = useMemo(() => {
    return productImage && logoImage && Object.keys(fileErrors).length === 0;
  }, [productImage, logoImage, fileErrors]);

  // isBatchFormValid (dari Tahap 1) (tetap sama)
  const isBatchFormValid = useMemo(() => {
    return productImages.length > 0 && logoImage && Object.keys(fileErrors).length === 0;
  }, [productImages, logoImage, fileErrors]);


  // handleSubmit (mode single) (tetap sama)
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !productImage || !logoImage) {
      validateFile(productImage, MAX_PRODUCT_SIZE_BYTES, 'product');
      validateFile(logoImage, MAX_LOGO_SIZE_BYTES, 'logo');
      return;
    };

    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);
    setGeneratedBatches([]);

    try {
      const images = await generateEditorialImages(productImage, logoImage, gender, age, aspectRatio, additionalInstructions);
      setGeneratedImages(images);
    } catch (err: any) {
      setError(err.message || 'Gagal menghasilkan gambar. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [productImage, logoImage, gender, age, aspectRatio, isFormValid, additionalInstructions]);

  // handleBatchSubmit (dari Tahap 2) (tetap sama)
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBatchFormValid || !logoImage) {
       validateFile(logoImage, MAX_LOGO_SIZE_BYTES, 'logo');
       if (productImages.length === 0) {
         setError("Pilih minimal 1 foto produk untuk batch.");
       }
       return;
    }
    
    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);
    setGeneratedBatches([]); 

    for (let i = 0; i < productImages.length; i++) {
      const product = productImages[i];
      
      setProcessingStatus(`Processing ${i + 1}/${productImages.length}: ${product.name}`);
      
      try {
        const images = await generateEditorialImages(
          product, 
          logoImage, 
          gender, 
          age, 
          aspectRatio
        );
        
        setGeneratedBatches(prev => [
          ...prev,
          { productName: product.name, images: images }
        ]);
        
      } catch (err: any) {
        console.error(`Gagal memproses ${product.name}:`, err);
        setError(`Gagal memproses ${product.name}: ${err.message}`); 
        
        setGeneratedBatches(prev => [
          ...prev,
          { productName: `${product.name} (FAILED)`, images: [] }
        ]);
      }
    }

    setIsLoading(false);
    setProcessingStatus(null);
  };
  
  // --- --- --- --- --- --- --- --- --- --- --- ---
  // --- INI ADALAH MODIFIKASI UNTUK TAHAP 4 ---
  // --- --- --- --- --- --- --- --- --- --- --- ---
  const handleDownloadAll = async () => {
    if (!window.JSZip) {
      alert('Could not download all files. JSZip library not found.');
      return;
    }
    setIsDownloading(true);
    const zip = new window.JSZip();
    let zipFileName = "fashion_product_studio.zip";

    if (isBatchMode) {
      // LOGIKA BATCH: Buat folder untuk setiap produk
      zipFileName = "fashion_product_studio_BATCH.zip";
      
      generatedBatches.forEach(batch => {
        // Ganti nama file produk menjadi nama folder yang valid
        const folderName = batch.productName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const folder = zip.folder(folderName);
        
        batch.images.forEach((src, index) => {
          const base64Data = src.split(',')[1];
          // Nama file di dalam folder
          folder.file(`pose_${index + 1}.png`, base64Data, { base64: true });
        });
      });

    } else {
      // LOGIKA SINGLE: Hanya tambahkan file ke root ZIP
      zipFileName = "fashion_product_studio_SINGLE.zip";
      
      generatedImages.forEach((src, index) => {
        const base64Data = src.split(',')[1];
        zip.file(`fashion_editorial_${index + 1}.png`, base64Data, { base64: true });
      });
    }
    
    // Logika generate ZIP (tetap sama)
    try {
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipFileName; // Gunakan nama file dinamis
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error("Error creating zip file", error);
        alert("Failed to create zip file.");
    } finally {
        setIsDownloading(false);
    }
  };
  // --- --- --- --- --- --- --- --- --- --- ---
  // --- AKHIR DARI MODIFIKASI TAHAP 4 ---
  // --- --- --- --- --- --- --- --- --- --- ---


  // Logika Modal (dari Tahap 3) (tetap sama)
  const allGeneratedImages = useMemo(() => {
    if (isBatchMode) {
      return generatedBatches.flatMap(batch => batch.images);
    }
    return generatedImages;
  }, [isBatchMode, generatedImages, generatedBatches]);

  const openModal = (globalIndex: number) => {
    setSelectedImageIndex(globalIndex);
    setIsModalOpen(true);
  };
  
  // Variabel untuk menentukan apakah tombol download harus tampil
  const showDownloadButton = !isLoading && (
    (!isBatchMode && generatedImages.length > 0) ||
    (isBatchMode && generatedBatches.length > 0)
  );


  // --- JSX (UI) ---
  return (
    <div id="generator" className="py-12 md:py-20 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          <div className="lg:col-span-1">
            {/* Form (dari Tahap 1) (tetap sama) */}
            <form onSubmit={isBatchMode ? handleBatchSubmit : handleSubmit} className="space-y-8">
              
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsBatchMode(false)}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${!isBatchMode ? 'bg-white shadow-sm text-primary' : 'text-gray-600'}`}
                >
                  Single Product
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchMode(true)}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${isBatchMode ? 'bg-white shadow-sm text-primary' : 'text-gray-600'}`}
                >
                  Batch (Up to 10)
                </button>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-800">1. Upload Aset Anda</h2>
                <p className="mt-2 text-gray-600">Unggah foto produk dan logo brand Anda untuk memulai.</p>
                <div className="mt-6 space-y-6">
                    
                    {!isBatchMode && (
                      <FileInput
                          id="product-image"
                          label="Foto Produk"
                          description="JPG/PNG, maks 10MB"
                          file={productImage}
                          onFileChange={handleFileChange(setProductImage, MAX_PRODUCT_SIZE_BYTES, 'product')}
                          error={fileErrors.product}
                      />
                    )}

                    {isBatchMode && (
                      <div>
                        <label htmlFor="batch-product-images" className="block text-sm font-medium text-gray-700">Foto Produk (Maks 10)</label>
                        <label
                          htmlFor="batch-product-images"
                          className="mt-1 relative flex justify-center items-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-primary-400 transition-colors duration-200"
                        >
                          <div className="space-y-1 text-center">
                            <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                              <span className="relative font-medium text-primary hover:text-primary-600">
                                <span>Upload files</span>
                                <input
                                  id="batch-product-images"
                                  name="batch-product-images"
                                  type="file"
                                  multiple
                                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                  onChange={handleBatchFileChange}
                                  className="sr-only"
                                />
                              </span>
                              <p className="pl-1">atau drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">JPG/PNG, maks 10MB per file</p>
                          </div>
                        </label>
                        
                        {productImages.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <h4 className="text-sm font-medium text-gray-700">Files to process:</h4>
                            <div className="max-h-32 overflow-y-auto pr-2 space-y-2">
                              {productImages.map(file => (
                                <div key={file.name} className="flex justify-between items-center p-2 bg-gray-100 rounded-md">
                                  <span className="text-sm text-gray-800 truncate" title={file.name}>{file.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeBatchFile(file.name)}
                                    className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                                    aria-label={`Remove ${file.name}`}
                                  >
                                    <XIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <FileInput
                        id="logo-image"
                        label="Logo Brand (Transparan)"
                        description="PNG, maks 5MB"
                        file={logoImage}
                        onFileChange={handleFileChange(setLogoImage, MAX_LOGO_SIZE_BYTES, 'logo')}
                        error={fileErrors.logo}
                    />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-800">2. Sesuaikan Foto</h2>
                <p className="mt-2 text-gray-600">Pilih model virtual dan rasio aspek gambar. (Berlaku untuk single & batch)</p>
                
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-800">Model Virtual</h3>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                      <select
                        id="gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value as Gender)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                      >
                        {GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="age" className="block text-sm font-medium text-gray-700">Usia</label>
                      <select
                        id="age"
                        value={age}
                        onChange={(e) => setAge(e.target.value as Age)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                      >
                        {AGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                   <h3 className="text-lg font-medium text-gray-800">Rasio Aspek</h3>
                    <fieldset className="mt-2">
                      <legend className="sr-only">Aspect Ratio</legend>
                      <div className="grid grid-cols-3 gap-3">
                        {ASPECT_RATIO_OPTIONS.map((option) => (
                          <div key={option.value}>
                            <input
                              type="radio"
                              name="aspect-ratio"
                              value={option.value}
                              id={`aspect-ratio-${option.value.replace(':', '-')}`}
                              checked={aspectRatio === option.value}
                              onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                              className="peer sr-only"
                            />
                            <label
                              htmlFor={`aspect-ratio-${option.value.replace(':', '-')}`}
                              className="block w-full text-center py-3 px-2 border rounded-md cursor-pointer text-sm font-medium transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50 peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary"
                            >
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                </div>

                {!isBatchMode && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-800">Instruksi Tambahan (Opsional)</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Berikan arahan spesifik untuk AI, contoh: "Gunakan model berhijab", "Pastikan detail kancing baju terlihat jelas".
                    </p>
                    <textarea
                        id="additional-instructions"
                        rows={3}
                        className="mt-2 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border border-gray-300 rounded-md"
                        placeholder="Contoh: Model tersenyum sambil melihat ke arah kamera..."
                        value={additionalInstructions}
                        onChange={(e) => setAdditionalInstructions(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={(!isBatchMode && !isFormValid) || (isBatchMode && !isBatchFormValid) || isLoading}
                className="w-full flex justify-center items-center bg-primary text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:bg-primary-600 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <><Spinner /> {processingStatus || 'Generating...'}</>
                ) : (
                  isBatchMode ? `Generate ${productImages.length} Products (${productImages.length * 4} Images)` : 'Generate 4 Images'
                )}
              </button>
            </form>
          </div>
          <div className="lg:col-span-2">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Hasil Foto Editorial</h2>
                    <p className="mt-2 text-gray-600">
                      {isBatchMode ? "Hasil batch akan muncul di sini setelah diproses." : "AI akan menghasilkan 4 variasi foto profesional untuk Anda."}
                    </p>
                </div>
                
                {/* --- MODIFIKASI TOMBOL DOWNLOAD TAHAP 4 --- */}
                {/* Tombol ini sekarang muncul di kedua mode jika ada hasil */}
                {showDownloadButton && (
                    <button 
                        onClick={handleDownloadAll} 
                        disabled={isDownloading}
                        className="flex-shrink-0 flex items-center gap-2 bg-white text-gray-700 font-semibold py-2 px-4 rounded-lg shadow-sm border border-gray-300 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isDownloading ? (
                            <><span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span><span>Zipping...</span></>
                        ) : (
                            <><DownloadIcon className="w-5 h-5" /><span>Download All (ZIP)</span></>
                        )}
                    </button>
                )}
                {/* --- AKHIR MODIFIKASI TAHAP 4 --- */}
            </div>
            
            <div className="mt-6">
                <ResultsDisplay
                    isLoading={isLoading}
                    isBatchMode={isBatchMode}
                    images={generatedImages}
                    batches={generatedBatches}
                    onImageClick={openModal}
                />
            </div>

          </div>
        </div>
      </div>

      {/* Modal (dari Tahap 3) (tetap sama) */}
      {isModalOpen && (
        <ImagePreviewModal
          images={allGeneratedImages}
          startIndex={selectedImageIndex}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {error && <Toast message={error} type="error" onDismiss={() => setError(null)} />}
    </div>
  );
};

export default Generator;