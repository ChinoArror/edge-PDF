import { useState, useEffect, useRef } from 'react';
import { FileUp, Cloud, FileText, Settings, Shield, Download, LogOut, Moon, Sun, Save, Loader2, Image as ImageIcon } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

export default function Dashboard({ setIsAuthenticated, isDarkMode, setIsDarkMode }: any) {
  const [activeTab, setActiveTab] = useState<'upload' | 'r2'>('upload');
  const [health, setHealth] = useState<string>('Checking API...');

  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null);
  const [r2Files, setR2Files] = useState<any[]>([]);
  const [selectedR2File, setSelectedR2File] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdfBytes, setGeneratedPdfBytes] = useState<Uint8Array | null>(null);
  const [isSavingToR2, setIsSavingToR2] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchR2Files = async () => {
    try {
      const res = await fetch('/api/r2/files');
      const data = await res.json();
      if (data.success) {
        setR2Files(data.files || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data.message))
      .catch(err => setHealth('API Error: ' + err.message));

    fetchR2Files();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setIsAuthenticated(false);
  };

  const handleGeneratePDF = async () => {
    if (!selectedLocalFile) return;
    setIsGenerating(true);
    setGeneratedPdfBytes(null);
    try {
      const arrayBuffer = await selectedLocalFile.arrayBuffer();
      let pdfBytes;

      if (selectedLocalFile.type === 'application/pdf') {
        const existingPdf = await PDFDocument.load(arrayBuffer);
        pdfBytes = await existingPdf.save();
      } else if (selectedLocalFile.type === 'image/jpeg' || selectedLocalFile.type === 'image/jpg' || selectedLocalFile.type === 'image/png') {
        const pdfDoc = await PDFDocument.create();
        let image;
        if (selectedLocalFile.type === 'image/png') {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else {
          image = await pdfDoc.embedJpg(arrayBuffer);
        }
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        pdfBytes = await pdfDoc.save();
      } else {
        alert("Please select a JPG, PNG, or PDF file.");
        setIsGenerating(false);
        return;
      }

      setGeneratedPdfBytes(pdfBytes);
    } catch (err: any) {
      alert("Error generating PDF: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedPdfBytes) return;
    const blob = new Blob([generatedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveToR2 = async () => {
    if (!generatedPdfBytes) return;
    setIsSavingToR2(true);
    try {
      const blob = new Blob([generatedPdfBytes], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', blob, `generated-${Date.now()}.pdf`);

      const res = await fetch('/api/r2/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        fetchR2Files();
        alert("Saved successfully to R2!");
      } else {
        alert("Error saving: " + data.message);
      }
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsSavingToR2(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300">
      {/* Header */}
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="bg-gradient-to-r from-green-500 to-purple-600 p-2 rounded-xl text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-purple-600 dark:from-green-400 dark:to-purple-400 tracking-tight">
            EdgePDF
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:block text-xs font-mono bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-800/50 shadow-inner">
            {health}
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all duration-300 hover:scale-110 hover:rotate-12"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        {/* Left Column: File Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl shadow-purple-500/5 dark:shadow-none border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-5 px-6 text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'upload'
                  ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-500/10'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
              >
                <FileUp className={`w-5 h-5 ${activeTab === 'upload' ? 'animate-bounce' : ''}`} />
                Local Upload
              </button>
              <button
                onClick={() => setActiveTab('r2')}
                className={`flex-1 py-5 px-6 text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'r2'
                  ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-green-50/50 dark:bg-green-500/10'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
              >
                <Cloud className={`w-5 h-5 ${activeTab === 'r2' ? 'animate-pulse' : ''}`} />
                Select from R2
              </button>
            </div>

            <div className="p-8">
              {activeTab === 'upload' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group border-2 border-dashed border-purple-300 dark:border-purple-500/30 rounded-3xl p-16 flex flex-col items-center justify-center text-center hover:bg-purple-50/50 dark:hover:bg-purple-500/5 hover:border-purple-500 dark:hover:border-purple-400 transition-all duration-500 cursor-pointer">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg, image/png, application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setSelectedLocalFile(e.target.files[0]);
                        setGeneratedPdfBytes(null);
                      }
                    }}
                  />
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 shadow-inner">
                    {selectedLocalFile ? <ImageIcon className="w-12 h-12" /> : <FileUp className="w-12 h-12" />}
                  </div>
                  <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {selectedLocalFile ? selectedLocalFile.name : "Click or drag files here"}
                  </h3>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Supports JPG, PNG, and PDF up to 50MB</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <Cloud className="w-6 h-6 text-green-500" />
                      Files in manual-uploads/
                    </h3>
                    <button onClick={fetchR2Files} className="text-sm text-green-600 dark:text-green-400 font-bold hover:text-green-700 dark:hover:text-green-300 hover:underline transition-all">Refresh List</button>
                  </div>
                  {/* Real R2 Files */}
                  {r2Files.length === 0 && <p className="text-sm text-zinc-500">No files found.</p>}
                  {r2Files.map((file, i) => (
                    <div key={i} onClick={() => setSelectedR2File(file.key)} className={`group flex items-center gap-4 p-4 rounded-2xl border ${selectedR2File === file.key ? 'border-green-500 bg-green-50 dark:bg-green-500/10' : 'border-zinc-200 dark:border-zinc-800'} hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50/50 dark:hover:bg-green-500/10 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg`}>
                      <input type="checkbox" checked={selectedR2File === file.key} readOnly className="w-5 h-5 rounded border-zinc-300 text-green-600 focus:ring-green-600 dark:border-zinc-700 dark:bg-zinc-800 transition-colors cursor-pointer" />
                      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl group-hover:bg-white dark:group-hover:bg-zinc-700 transition-colors shadow-sm">
                        <FileText className="w-6 h-6 text-zinc-500 dark:text-zinc-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors">{file.key}</p>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB • {file.uploaded ? new Date(file.uploaded).toLocaleString() : 'Just now'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Actions */}
        <div className="space-y-6">
          {/* PDF Settings */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-lg shadow-zinc-200/50 dark:shadow-none border border-zinc-200 dark:border-zinc-800 p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl">
                <Settings className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-extrabold">PDF Settings</h2>
            </div>

            <div className="space-y-5">
              <div className="group">
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Page Size</label>
                <select className="w-full rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3.5 text-sm font-medium focus:ring-0 focus:border-purple-500 dark:focus:border-purple-500 transition-all outline-none cursor-pointer hover:border-purple-400 dark:hover:border-purple-500/50">
                  <option>A4 (Standard)</option>
                  <option>Letter</option>
                  <option>Fit to Image</option>
                </select>
              </div>

              <div className="group">
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Orientation</label>
                <select className="w-full rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3.5 text-sm font-medium focus:ring-0 focus:border-purple-500 dark:focus:border-purple-500 transition-all outline-none cursor-pointer hover:border-purple-400 dark:hover:border-purple-500/50">
                  <option>Portrait</option>
                  <option>Landscape</option>
                  <option>Auto</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Button */}
          {generatedPdfBytes ? (
            <div className="flex gap-4">
              <button
                onClick={handleDownload}
                className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white rounded-2xl py-4 px-6 font-extrabold text-lg flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/30 active:scale-95">
                <Download className="w-6 h-6 animate-bounce" />
                Download
              </button>
              <button
                onClick={handleSaveToR2}
                disabled={isSavingToR2}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white rounded-2xl py-4 px-6 font-extrabold text-lg flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/30 active:scale-95 disabled:opacity-50">
                {isSavingToR2 ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                Save to R2
              </button>
            </div>
          ) : (
            <button
              onClick={handleGeneratePDF}
              disabled={!selectedLocalFile || isGenerating}
              className="w-full bg-gradient-to-r from-green-500 to-purple-600 hover:from-green-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl py-4 px-6 font-extrabold text-lg flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/30 active:scale-95">
              {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Settings className="w-6 h-6" />}
              Generate PDF
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
