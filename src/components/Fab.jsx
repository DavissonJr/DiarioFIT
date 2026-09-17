import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

/**
 * Botão de adicionar fixo no canto. Ele desce ao rolar para baixo e volta ao
 * rolar para cima, para não cobrir os números da lista enquanto se lê.
 */
export default function Fab({ onClick, label }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) < 14) return;
      setHidden(y > lastY.current && y > 140);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`fixed bottom-[88px] right-4 z-30 grid h-14 w-14 place-items-center rounded-full
        bg-leaf-500 text-white shadow-lift transition duration-300 active:scale-95
        md:bottom-8 md:right-8 md:h-16 md:w-16
        ${hidden ? 'pointer-events-none translate-y-[160%] opacity-0' : ''}`}
    >
      <Plus size={26} />
    </button>
  );
}
