import React from 'react';
import { 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio,
  FileSpreadsheet,
  FileCode,
  Archive,
  File
} from 'lucide-react';

interface FileTypeIconProps {
  fileType: string;
  className?: string;
}

export function FileTypeIcon({ fileType, className = "w-5 h-5" }: FileTypeIconProps) {
  const getIconByType = (type: string) => {
    const lowerType = type.toLowerCase();
    
    // Document types
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(lowerType)) {
      return { icon: FileText, color: 'bg-red-100 text-red-600' };
    }
    
    // Image types
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(lowerType)) {
      return { icon: FileImage, color: 'bg-green-100 text-green-600' };
    }
    
    // Video types
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(lowerType)) {
      return { icon: FileVideo, color: 'bg-purple-100 text-purple-600' };
    }
    
    // Audio types
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(lowerType)) {
      return { icon: FileAudio, color: 'bg-orange-100 text-orange-600' };
    }
    
    // Spreadsheet types
    if (['xls', 'xlsx', 'csv', 'ods'].includes(lowerType)) {
      return { icon: FileSpreadsheet, color: 'bg-blue-100 text-blue-600' };
    }
    
    // Code types
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php'].includes(lowerType)) {
      return { icon: FileCode, color: 'bg-indigo-100 text-indigo-600' };
    }
    
    // Archive types
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(lowerType)) {
      return { icon: Archive, color: 'bg-yellow-100 text-yellow-600' };
    }
    
    // Default
    return { icon: File, color: 'bg-gray-100 text-gray-600' };
  };

  const { icon: IconComponent, color } = getIconByType(fileType);

  return (
    <div className={`file-icon ${color} ${className}`}>
      <IconComponent className="w-4 h-4" />
    </div>
  );
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}