import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** Código QR dibujado como SVG, sin internet. Módulos oscuros sobre blanco para que lo lea cualquier cámara. */
export function Qr({ texto, tamano, etiqueta }: { texto: string; tamano: number; etiqueta: string }) {
    const { n, ruta } = useMemo(() => {
        const qr = qrcode(0, 'M');
        qr.addData(texto);
        qr.make();
        const n = qr.getModuleCount();
        let ruta = '';
        for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (qr.isDark(f, c)) ruta += `M${c} ${f}h1v1h-1z`;
        return { n, ruta };
    }, [texto]);
    const margen = 3;
    return (
        <svg role="img" aria-label={etiqueta} width={tamano} height={tamano}
            viewBox={`${-margen} ${-margen} ${n + 2 * margen} ${n + 2 * margen}`} shapeRendering="crispEdges"
            className="rounded-3xl bg-white">
            <path d={ruta} fill="#0C0E1A" />
        </svg>
    );
}
