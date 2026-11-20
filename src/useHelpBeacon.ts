import { useState } from "react";

const seenKey = "diyjobresume.help.seen";
export function useHelpBeacon() {
  const [unseen, setUnseen] = useState(() => {
    try {
      return sessionStorage.getItem(seenKey) !== "1";
    } catch {
      return true;
    }
  });
  return {
    unseen,
    acknowledge: () => {
      setUnseen(false);
      try {
        sessionStorage.setItem(seenKey, "1");
      } catch {
        /* The help remains available without storage. */
      }
    },
  };
}
