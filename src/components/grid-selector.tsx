'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface GridSelectorProps {
  initialRows?: number;
  initialCols?: number;
  maxRows?: number;
  maxCols?: number;
  onChange: (rows: number, cols: number) => void;
}

export function GridSelector({
  initialRows = 1,
  initialCols = 1,
  maxRows = 8,
  maxCols = 8,
  onChange,
}: GridSelectorProps) {
  const [hoveredRows, setHoveredRows] = useState(initialRows);
  const [hoveredCols, setHoveredCols] = useState(initialCols);
  const [selectedRows, setSelectedRows] = useState(initialRows);
  const [selectedCols, setSelectedCols] = useState(initialCols);

  const handleMouseEnter = (r: number, c: number) => {
    setHoveredRows(r);
    setHoveredCols(c);
  };

  const handleMouseLeave = () => {
    // Reset hover to selected if not actively selecting
    setHoveredRows(selectedRows);
    setHoveredCols(selectedCols);
  };

  const handleClick = (r: number, c: number) => {
    setSelectedRows(r);
    setSelectedCols(c);
    onChange(r, c);
  };

  return (
    <div
      className="grid gap-1 p-2 border rounded-md bg-background cursor-pointer w-fit mx-auto md:mx-0"
      style={{
        gridTemplateColumns: `repeat(${maxCols}, 1.5rem)`, // Adjust size as needed
        gridTemplateRows: `repeat(${maxRows}, 1.5rem)`, // Adjust size as needed
      }}
      onMouseLeave={handleMouseLeave}
    >
      {Array.from({ length: maxRows }).map((_, r) =>
        Array.from({ length: maxCols }).map((_, c) => {
          const rowIndex = r + 1;
          const colIndex = c + 1;
          const isHovered = rowIndex <= hoveredRows && colIndex <= hoveredCols;
          const isSelected = rowIndex <= selectedRows && colIndex <= selectedCols;

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                'w-full h-full border border-border transition-colors duration-100',
                {
                  'bg-primary/70 border-primary': isHovered,
                  'bg-primary border-primary': isSelected,
                   'bg-muted/50': !isHovered && !isSelected,
                }
              )}
              onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
              onClick={() => handleClick(rowIndex, colIndex)}
              role="button"
              aria-label={`Select ${rowIndex} rows and ${colIndex} columns`}
              tabIndex={0} // Make it focusable, though full keyboard nav isn't implemented here
               onKeyDown={(e) => {
                 if (e.key === 'Enter' || e.key === ' ') {
                   handleClick(rowIndex, colIndex);
                 }
               }}
            />
          );
        })
      )}
    </div>
  );
}
