"use client";
import { useState, useRef, useEffect } from "react";
import type { Priority } from "@/lib/data";

export type CaptureInput = {
  text: string;
  project: string;
  priority: Priority;
  due: string;
  source: string;
};

interface Props {
  onAdd: (input: CaptureInput) => void;
}

export default function QuickAdd({ onAdd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue]       = useState("");
  const [project, setProject]   = useState("Inbox");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [due, setDue]           = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const reset = () => {
    setValue("");
    setProject("Inbox");
    setPriority("MEDIUM");
    setDue("");
    setExpanded(false);
  };

  const save = () => {
    const text = value.trim();
    if (text) onAdd({ text, project: project.trim() || "Inbox", priority, due: due.trim(), source: "dashboard-quick-capture" });
    reset();
  };

  if (!expanded) {
    return (
      <button className="quickAddBtn" onClick={() => setExpanded(true)}>
        + Capture a loop
      </button>
    );
  }

  return (
    <div className="quickAddExpanded quickAddExpanded--stacked">
      <input
        ref={inputRef}
        className="quickAddInput"
        placeholder="What's open?"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          if (e.key === "Escape") reset();
        }}
      />
      <div className="quickAddFields">
        <input className="quickAddMini" value={project} onChange={e => setProject(e.target.value)} placeholder="Project" />
        <select className="quickAddMini" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <input className="quickAddMini" value={due} onChange={e => setDue(e.target.value)} placeholder="Due/follow-up" />
      </div>
      <div className="quickAddActions">
        <button className="quickAddSave" onClick={save}>Save durable loop</button>
        <button className="quickAddCancel" onClick={reset}>Cancel</button>
      </div>
    </div>
  );
}
