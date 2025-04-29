'use client';

import { useState, useCallback, useRef, type DragEvent } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, Merge, Settings, Download, Trash2, ArrowLeftRight, ArrowUpDown, Rows, Columns, Grid } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GridSelector } from './grid-selector';


interface PdfFile {
  id: string;
  file: File;
  name: string;
  previewUrl?: string; // Optional: for future preview implementation
}

interface RestructureFile {
  file: File;
  name: string;
}


export function PdfFusion() {
  const [mergeFiles, setMergeFiles] = useState<PdfFile[]>([]);
  const [restructureFile, setRestructureFile] = useState<RestructureFile | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);
  const [restructureMode, setRestructureMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [rows, setRows] = useState<number>(2);
  const [cols, setCols] = useState<number>(2);

  const { toast } = useToast();
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const restructureInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'merge' | 'restructure') => {
    const files = event.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
    }));

    if (type === 'merge') {
      setMergeFiles((prevFiles) => [...prevFiles, ...newFiles]);
    } else if (newFiles.length > 0) {
       if (restructureFile) {
         toast({
           title: "Replace File",
           description: "Replacing the existing file for restructuring.",
           variant: "default",
         });
       }
      setRestructureFile({ file: newFiles[0].file, name: newFiles[0].name });
    }

    // Reset file input
    event.target.value = '';
  };

  const removeFile = (id: string, type: 'merge' | 'restructure') => {
    if (type === 'merge') {
      setMergeFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
    } else {
      setRestructureFile(null);
    }
  };

  const handleMerge = async () => {
    if (mergeFiles.length < 2) {
      toast({
        title: 'Error',
        description: 'Please select at least two PDF files to merge.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    setProgress(0);

    try {
      const mergedPdf = await PDFDocument.create();
      let currentProgress = 0;
      const totalFiles = mergeFiles.length;

      for (let i = 0; i < totalFiles; i++) {
        const file = mergeFiles[i];
        const pdfBytes = await file.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true }); // Added ignoreEncryption
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));

        currentProgress = ((i + 1) / totalFiles) * 100;
        setProgress(currentProgress);
         // Add a small delay for smoother progress update
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const mergedPdfBytes = await mergedPdf.save();
      downloadPdf(mergedPdfBytes, 'merged_document.pdf');
      toast({
        title: 'Success',
        description: 'PDFs merged successfully!',
      });
       setMergeFiles([]); // Clear files after successful merge
    } catch (error: any) {
        console.error('Error merging PDFs:', error);
        // Provide more specific error messages
        let errorMessage = 'An error occurred while merging PDFs.';
        if (error.message.includes('encrypted')) {
            errorMessage = 'One or more PDFs are encrypted or password-protected. Cannot merge.';
        } else if (error.message.includes('Invalid PDF')) {
            errorMessage = 'One or more files are not valid PDFs or are corrupted.';
        }
        toast({
            title: 'Merge Error',
            description: errorMessage,
            variant: 'destructive',
        });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };


  const handleRestructure = async () => {
    if (!restructureFile) {
      toast({
        title: 'Error',
        description: 'Please select a PDF file to restructure.',
        variant: 'destructive',
      });
      return;
    }
    if (rows < 1 || cols < 1 || rows * cols < 1) {
        toast({
            title: 'Error',
            description: 'Number of rows and columns must be at least 1.',
            variant: 'destructive',
        });
        return;
    }


    setProcessing(true);
    setProgress(0);

    try {
      const pdfBytes = await restructureFile.file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true }); // Added ignoreEncryption
      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      if (totalPages === 0) {
          toast({
              title: 'Error',
              description: 'The selected PDF has no pages.',
              variant: 'destructive',
          });
          setProcessing(false);
          return;
      }


      const newPdfDoc = await PDFDocument.create();
      const pagesPerNewPage = rows * cols;


       for (let i = 0; i < totalPages; i += pagesPerNewPage) {
            const chunk = pages.slice(i, Math.min(i + pagesPerNewPage, totalPages));
            if (chunk.length === 0) continue;

            // Use the size of the first page in the chunk as the reference for the new page size
            const { width: refWidth, height: refHeight } = chunk[0].getSize();
            const newPage = newPdfDoc.addPage([refWidth, refHeight]);

            const tileWidth = refWidth / cols;
            const tileHeight = refHeight / rows;


            for (let j = 0; j < chunk.length; j++) {
                 const pageToEmbed = chunk[j];
                 const { width: pageWidth, height: pageHeight } = pageToEmbed.getSize();

                 // Calculate scale to fit the original page into the tile dimensions
                 const scaleX = tileWidth / pageWidth;
                 const scaleY = tileHeight / pageHeight;
                 const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

                 // Calculate the position within the new page grid
                 const rowIndex = Math.floor(j / cols);
                 const colIndex = j % cols;

                 let xPos, yPos;
                if (restructureMode === 'horizontal') {
                     xPos = colIndex * tileWidth;
                     yPos = refHeight - (rowIndex + 1) * tileHeight; // PDF coordinates start from bottom-left
                 } else { // vertical
                     xPos = rowIndex * tileWidth; // For vertical, rows become columns and vice-versa conceptually
                     yPos = refHeight - (colIndex + 1) * tileHeight;
                 }

                 // Center the scaled page within its tile
                const scaledWidth = pageWidth * scale;
                const scaledHeight = pageHeight * scale;
                xPos += (tileWidth - scaledWidth) / 2;
                yPos += (tileHeight - scaledHeight) / 2;


                const embeddedPage = await newPdfDoc.embedPage(pageToEmbed);

                newPage.drawPage(embeddedPage, {
                    x: xPos,
                    y: yPos,
                    width: scaledWidth,
                    height: scaledHeight,
                });
            }
            setProgress(((i + chunk.length) / totalPages) * 100);
             // Add a small delay for smoother progress update
             await new Promise(resolve => setTimeout(resolve, 50));
        }


      const newPdfBytes = await newPdfDoc.save();
      downloadPdf(newPdfBytes, `restructured_${restructureFile.name}`);
      toast({
        title: 'Success',
        description: 'PDF restructured successfully!',
      });
       setRestructureFile(null); // Clear file after success
    } catch (error: any) {
      console.error('Error restructuring PDF:', error);
       let errorMessage = 'An error occurred while restructuring the PDF.';
        if (error.message.includes('encrypted')) {
            errorMessage = 'The PDF is encrypted or password-protected. Cannot restructure.';
        } else if (error.message.includes('Invalid PDF')) {
            errorMessage = 'The file is not a valid PDF or is corrupted.';
        }
      toast({
        title: 'Restructure Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const downloadPdf = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
     e.dataTransfer.effectAllowed = 'move';
     setDraggedItemIndex(index);
     e.currentTarget.classList.add('dragging');
   };

   const handleDragEnter = (e: DragEvent<HTMLDivElement>, index: number) => {
     e.preventDefault();
     setDragOverItemIndex(index);
     e.currentTarget.classList.add('drag-over');
   };

   const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
     e.currentTarget.classList.remove('drag-over');
      if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
          return; // Don't remove if moving to a child element
      }
     // Only reset dragOverItemIndex if we are truly leaving the item, not just moving between its children
     if (!e.currentTarget.contains(e.relatedTarget as Node)) {
         setDragOverItemIndex(null);
     }
   };

   const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
     e.preventDefault(); // Necessary to allow dropping
     e.dataTransfer.dropEffect = 'move';
   };

   const handleDrop = (e: DragEvent<HTMLDivElement>, index: number) => {
     e.preventDefault();
     e.currentTarget.classList.remove('drag-over');
     if (draggedItemIndex === null) return;

     const newFiles = [...mergeFiles];
     const draggedItem = newFiles.splice(draggedItemIndex, 1)[0];
     newFiles.splice(index, 0, draggedItem);

     setMergeFiles(newFiles);
     setDraggedItemIndex(null);
     setDragOverItemIndex(null);
   };

    const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('dragging');
        // Clean up drag styles from all items just in case
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        setDraggedItemIndex(null);
        setDragOverItemIndex(null);
    };

  const triggerFileInput = (type: 'merge' | 'restructure') => {
      if (type === 'merge' && mergeInputRef.current) {
        mergeInputRef.current.click();
      } else if (type === 'restructure' && restructureInputRef.current) {
        restructureInputRef.current.click();
      }
    };

   const handleGridChange = (newRows: number, newCols: number) => {
     setRows(newRows);
     setCols(newCols);
   };


  return (
    <Tabs defaultValue="merge" className="w-full max-w-4xl mx-auto">
      <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary">
        <TabsTrigger value="merge" className="py-3 text-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
          <Merge className="mr-2 h-5 w-5" /> Merge PDFs
        </TabsTrigger>
        <TabsTrigger value="restructure" className="py-3 text-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
          <Settings className="mr-2 h-5 w-5" /> Restructure PDF
        </TabsTrigger>
      </TabsList>

      {/* Merge Tab */}
      <TabsContent value="merge">
        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
              <Merge className="h-6 w-6" /> Merge Multiple PDFs
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Combine several PDF files into a single document. Drag and drop to reorder files before merging.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
               <Button onClick={() => triggerFileInput('merge')} variant="outline" size="lg" className="w-full md:w-auto border-dashed border-2 border-primary text-primary hover:bg-primary/10">
                 <Upload className="mr-2 h-5 w-5" /> Select PDFs to Merge
               </Button>
               <Input
                   ref={mergeInputRef}
                   type="file"
                   accept="application/pdf"
                   multiple
                   onChange={(e) => handleFileChange(e, 'merge')}
                   className="hidden"
                   id="merge-file-input"
               />
               <p className="text-sm text-muted-foreground">Or drag and drop files here</p>
            </div>

            {mergeFiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Selected Files ({mergeFiles.length}):</h3>
                 <div className="border rounded-md p-4 space-y-2 max-h-60 overflow-y-auto bg-background">
                    {mergeFiles.map((pdfFile, index) => (
                      <div
                        key={pdfFile.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-2 rounded-md border bg-card hover:bg-muted/50 cursor-move transition-all duration-150 ease-in-out ${draggedItemIndex === index ? 'dragging' : ''} ${dragOverItemIndex === index ? 'drag-over' : ''}`}
                      >
                        <span className="text-sm font-medium text-card-foreground truncate mr-2">{index + 1}. {pdfFile.name}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeFile(pdfFile.id, 'merge')} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove {pdfFile.name}</span>
                        </Button>
                      </div>
                    ))}
                    {/* Placeholder for drop visualization */}
                   {draggedItemIndex !== null && dragOverItemIndex === mergeFiles.length && (
                      <div className="h-10 border-2 border-dashed border-primary rounded-md bg-muted/30 transition-all"></div>
                    )}
                  </div>
              </div>
            )}

            {processing && (
                <div className="space-y-2">
                     <Label className="text-sm font-medium text-primary">Processing...</Label>
                    <Progress value={progress} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-primary" />
                     <p className="text-xs text-muted-foreground text-right">{Math.round(progress)}% complete</p>
                 </div>
            )}

          </CardContent>
          <CardFooter>
            <Button
              onClick={handleMerge}
              disabled={processing || mergeFiles.length < 2}
              size="lg"
              className="w-full bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                  <>
                     <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                     Merging...
                  </>
              ) : (
                <>
                  <Merge className="mr-2 h-5 w-5" /> Merge PDFs
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* Restructure Tab */}
      <TabsContent value="restructure">
        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
                <Settings className="h-6 w-6" /> Restructure PDF Pages
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Combine multiple pages of a single PDF onto one page, arranged horizontally or vertically in a grid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex flex-col items-center space-y-4">
                <Button onClick={() => triggerFileInput('restructure')} variant="outline" size="lg" className="w-full md:w-auto border-dashed border-2 border-primary text-primary hover:bg-primary/10">
                  <Upload className="mr-2 h-5 w-5" /> Select PDF to Restructure
                </Button>
                <Input
                    ref={restructureInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileChange(e, 'restructure')}
                    className="hidden"
                    id="restructure-file-input"
                />
               <p className="text-sm text-muted-foreground">Or drag and drop a single file here</p>
             </div>

             {restructureFile && (
               <div className="border rounded-md p-4 bg-card space-y-3">
                 <h3 className="text-lg font-medium text-foreground">Selected File:</h3>
                 <div className="flex items-center justify-between p-2 rounded-md border bg-background">
                    <span className="text-sm font-medium text-foreground truncate mr-2">{restructureFile.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeFile('', 'restructure')} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                      <Trash2 className="h-4 w-4" />
                       <span className="sr-only">Remove {restructureFile.name}</span>
                    </Button>
                  </div>
               </div>
             )}


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
               {/* Arrangement Options */}
                 <div className="space-y-3">
                     <Label className="text-base font-medium flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-primary" /> Arrangement</Label>
                     <RadioGroup defaultValue="horizontal" value={restructureMode} onValueChange={(value: 'horizontal' | 'vertical') => setRestructureMode(value)} className="flex space-x-4">
                       <div className="flex items-center space-x-2">
                         <RadioGroupItem value="horizontal" id="horizontal" />
                         <Label htmlFor="horizontal" className="cursor-pointer flex items-center gap-1"><Columns className="w-4 h-4"/>Horizontal</Label>
                       </div>
                       <div className="flex items-center space-x-2">
                         <RadioGroupItem value="vertical" id="vertical" />
                         <Label htmlFor="vertical" className="cursor-pointer flex items-center gap-1"><Rows className="w-4 h-4"/>Vertical</Label>
                       </div>
                     </RadioGroup>
                       <p className="text-xs text-muted-foreground">
                            {restructureMode === 'horizontal'
                              ? 'Pages fill row by row, left to right, then top to bottom.'
                              : 'Pages fill column by column, top to bottom, then left to right.'}
                       </p>
                 </div>


               {/* Grid Size Options */}
                <div className="space-y-3">
                     <Label className="text-base font-medium flex items-center gap-2"><Grid className="w-5 h-5 text-primary" /> Grid Size (Pages per Sheet)</Label>
                     <GridSelector
                        initialRows={rows}
                        initialCols={cols}
                        maxRows={8}
                        maxCols={8}
                        onChange={handleGridChange}
                     />
                     <p className="text-xs text-muted-foreground text-center md:text-left mt-2">
                         Selected: {rows} {rows > 1 ? 'Rows' : 'Row'} x {cols} {cols > 1 ? 'Columns' : 'Column'} ({rows * cols} pages/sheet)
                     </p>
                 </div>
            </div>

            {processing && (
               <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Processing...</Label>
                   <Progress value={progress} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-primary" />
                    <p className="text-xs text-muted-foreground text-right">{Math.round(progress)}% complete</p>
                </div>
            )}

          </CardContent>
          <CardFooter>
            <Button
              onClick={handleRestructure}
              disabled={processing || !restructureFile}
              size="lg"
              className="w-full bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                 <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                    Restructuring...
                 </>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" /> Restructure & Download
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
