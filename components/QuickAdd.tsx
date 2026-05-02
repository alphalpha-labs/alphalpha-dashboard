"use client";
import { useState, useRef, useEffect } from "react";

interface Props {
  onAdd: (text: string) => void;
}

export default function QuickAdd({ onAdd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const save = () => {
    const text = value.trim();
    if (text) { onAdd(text); }
    setValue("");
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <button className="quickAddBtn" onClick={() => setExpanded(true)}>
        + Capture a loop
      </button>
    );
  }

  return (
    <div className="quickAddExpanded">
      <input
        ref={inputRef}
        className="quickAddInput"
        placeholder="What's open?"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setValue(""); setExpanded(false); }
        }}
      />
      <button className="quickAddSave" onClick={save}>Save</button>
    </div>
  );
}
