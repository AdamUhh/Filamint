import type { Shortcut } from '@bindings';
import { useState, useRef, useEffect } from 'react';


export interface ShortcutsByCategory {
  [category: string]: Shortcut[];
}

interface ShortcutInputProps {
  value: string;
  onChange: (keyCombo: string) => void;
  onCancel: () => void;
  error?: string;
}

export function ShortcutInput({ value, onChange, onCancel, error }: ShortcutInputProps) {
  const [recording, setRecording] = useState(false);
  const [currentCombo, setCurrentCombo] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (recording && inputRef.current) {
      inputRef.current.focus();
    }
  }, [recording]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return;
    
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setRecording(false);
      setCurrentCombo(value);
      onCancel();
      return;
    }

    const parts: string[] = [];
    
    if (e.ctrlKey || e.metaKey) {
      parts.push(e.metaKey ? 'Cmd' : 'Ctrl');
    }
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    
    const key = e.key;
    if (key !== 'Control' && key !== 'Meta' && key !== 'Alt' && key !== 'Shift') {
      // Handle special keys
      if (key.startsWith('F') && key.length <= 3) {
        parts.push(key.toUpperCase());
      } else if (key.length === 1) {
        parts.push(key.toUpperCase());
      } else if (['Enter', 'Space', 'Tab', 'Backspace', 'Delete'].includes(key)) {
        parts.push(key);
      }
    }

    if (parts.length > 0 && parts[parts.length - 1] !== 'Cmd' && parts[parts.length - 1] !== 'Ctrl' && parts[parts.length - 1] !== 'Alt' && parts[parts.length - 1] !== 'Shift') {
      const combo = parts.join('+');
      setCurrentCombo(combo);
    }
  };

  const handleSave = () => {
    onChange(currentCombo);
    setRecording(false);
  };

  const handleCancel = () => {
    setCurrentCombo(value);
    setRecording(false);
    onCancel();
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={currentCombo}
        readOnly
        onKeyDown={handleKeyDown}
        onClick={() => setRecording(true)}
        placeholder={recording ? "Press keys..." : "Click to record"}
        className={`px-3 py-1.5 border rounded ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${recording ? 'ring-2 ring-blue-500' : ''} cursor-pointer focus:outline-none`}
      />
      
      {recording ? (
        <>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setRecording(true)}
          className="px-3 py-1.5 bg-gray-100 rounded hover:bg-gray-200"
        >
          Edit
        </button>
      )}
    </div>
  );
}
