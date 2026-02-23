import { useEffect } from 'react';

const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} | Krishihub` : 'Krishihub';
  }, [title]);
};

export default usePageTitle;
