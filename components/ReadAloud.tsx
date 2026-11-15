"use client";

import { secondary } from "./ui";
import { SpeakerIcon } from "./icons";

/** Reads the schedule out loud with the browser's own voice (no service, works offline). */
export function ReadAloud({ text }: { text: string }) {
  function speak() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }
  return (
    <button type="button" onClick={speak} className={`${secondary} w-full text-lg`}>
      <SpeakerIcon className="h-6 w-6" /> Read it to me
    </button>
  );
}
