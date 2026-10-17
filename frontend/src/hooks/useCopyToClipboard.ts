import { useState } from 'react';

type CopyFn = (text: string) => Promise<boolean>;

export function useCopyToClipboard(): [boolean, CopyFn] {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copy: CopyFn = async (text) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return true;
    } catch (error) {
      console.warn('Copy failed', error);
      setIsCopied(false);
      return false;
    }
  };

  return [isCopied, copy];
}
