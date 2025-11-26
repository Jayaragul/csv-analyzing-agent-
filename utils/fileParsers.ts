import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for PDF.js
// We use the URL from the import map or a direct CDN link matching the version
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

/**
 * Parses an Excel file (.xlsx, .xls) and returns it as a CSV string.
 * It reads the first sheet by default.
 */
export const parseExcelToCSV = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    if (workbook.SheetNames.length === 0) {
        throw new Error("Excel file is empty");
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert sheet to CSV
    return XLSX.utils.sheet_to_csv(worksheet);
};

/**
 * Extracts text from a PDF file.
 */
export const parsePDFToText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Iterate through all pages
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract text items and join them
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
            
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    
    return fullText;
};
