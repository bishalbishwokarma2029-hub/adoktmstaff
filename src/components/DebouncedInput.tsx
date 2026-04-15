import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  delay?: number;
}

export default function DebouncedInput({ value, onChange, delay = 500, ...props }: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(String(value ?? ''));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setLocalValue(String(value ?? ''));
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChangeRef.current(v), delay);
  }, [delay]);

  const handleBlur = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onChangeRef.current(localValue);
  }, [localValue]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return <Input {...props} value={localValue} onChange={handleChange} onBlur={handleBlur} />;
}
