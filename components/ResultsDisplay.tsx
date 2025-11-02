import React from 'react';
// Hapus import ImagePreviewModal karena sudah dipindah
// import ImagePreviewModal from './ImagePreviewModal';

// Definisikan tipe batch di sini agar bisa digunakan
type GeneratedBatch = {
  productName: string;
  images: string[];
}

interface ResultsDisplayProps {
  isLoading: boolean;
  isBatchMode: boolean;
  images: string[]; // Untuk mode single
  batches: GeneratedBatch[]; // Untuk mode batch
  onImageClick: (globalIndex: number) => void;
}

// Skeleton loader component (tetap sama)
const SkeletonCard: React.FC = () => (
  <div className="aspect-[3/4] bg-gray-200 rounded-lg animate-pulse"></div>
);

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ isLoading, isBatchMode, images, batches, onImageClick }) => {

  // --- LOGIKA BARU UNTUK MENGHITUNG INDEX ---
  // Kita perlu memetakan batch ke 'global index' untuk modal
  // Buat Peta (Map) yang menyimpan [batchIndex, startIndex]
  const batchStartIndexMap = new Map<number, number>();
  let runningIndex = 0;
  batches.forEach((batch, index) => {
    batchStartIndexMap.set(index, runningIndex);
    runningIndex += batch.images.length;
  });
  // --- AKHIR LOGIKA BARU ---


  if (isLoading) {
    // Tampilkan 4 skeleton
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, index) => <SkeletonCard key={index} />)}
      </div>
    );
  }

  // Tampilan untuk Mode Batch
  if (isBatchMode) {
    if (batches.length === 0) {
      // Empty state untuk batch
      return (
        <div className="flex flex-col items-center justify-center text-center bg-gray-100 rounded-lg p-8 h-full min-h-[400px]">
          <img src="https://picsum.photos/seed/batch/200/200" alt="Empty state illustration" className="w-40 h-40 mb-4 rounded-full opacity-50" />
          <h3 className="text-xl font-semibold text-gray-700">Hasil Batch Akan Muncul di Sini</h3>
          <p className="mt-2 text-gray-500">Selesaikan form dan klik 'Generate' untuk memulai proses batch.</p>
        </div>
      );
    }

    // Render hasil batch yang dikelompokkan
    return (
      <div className="space-y-8">
        {batches.map((batch, batchIndex) => (
          <div key={batch.productName + batchIndex}>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">{batch.productName}</h3>
            
            {/* Tampilkan jika batch spesifik ini gagal */}
            {batch.images.length === 0 && (
              <p className="text-red-600">Gagal memproses produk ini.</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {batch.images.map((src, imgIndex) => {
                // Ambil 'startIndex' dari Peta (Map) yang kita buat
                const startIndex = batchStartIndexMap.get(batchIndex) || 0;
                // 'globalIndex' adalah index gambar ini di dalam array 'allGeneratedImages'
                const globalIndex = startIndex + imgIndex;

                return (
                  <div
                    key={src + imgIndex}
                    className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg shadow-md"
                    onClick={() => onImageClick(globalIndex)} // Gunakan globalIndex
                    role="button"
                    aria-label={`Preview image ${globalIndex + 1}`}
                  >
                    <img
                      src={src}
                      alt={`Generated image ${globalIndex + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity duration-300 flex items-center justify-center">
                      <p className="text-white opacity-0 group-hover:opacity-100 font-semibold transition-opacity duration-300">
                        Preview
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Tampilan untuk Mode Single (logika lama)
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center bg-gray-100 rounded-lg p-8 h-full min-h-[400px]">
        <img src="https://picsum.photos/seed/fashion/200/200" alt="Empty state illustration" className="w-40 h-40 mb-4 rounded-full opacity-50" />
        <h3 className="text-xl font-semibold text-gray-700">Hasil Akan Muncul di Sini</h3>
        <p className="mt-2 text-gray-500">Lengkapi form di samping untuk mulai membuat foto katalog Anda.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {images.map((src, index) => (
          <div
            key={index}
            className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg shadow-md"
            onClick={() => onImageClick(index)} // Gunakan prop onImageClick
            role="button"
            aria-label={`Preview image ${index + 1}`}
          >
            <img
              src={src}
              alt={`Generated fashion editorial image ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity duration-300 flex items-center justify-center">
              <p className="text-white opacity-0 group-hover:opacity-100 font-semibold transition-opacity duration-300">
                Preview
              </p>
            </div>
          </div>
        ))}
      </div>
      {/* MODAL DIHAPUS DARI SINI. 
        Kita akan memindahkannya ke Generator.tsx 
      */}
    </>
  );
};

export default ResultsDisplay;
