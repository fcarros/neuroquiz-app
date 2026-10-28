import { describe, it, expect } from 'vitest';
import { almacenEnMemoria } from '../profesor/pruebas';
import { almacenIdentidades } from './cliente';

const ana = { pin: '111111', id: 'id-ana-0000000001', secreto: 'secreto-ana-00001' };
const otra = { pin: '222222', id: 'id-ana-0000000002', secreto: 'secreto-ana-00002' };

describe('identidad del alumno, por sala', () => {
    it('una por sala, y sin PIN se usa la última', () => {
        const almacen = almacenEnMemoria();
        const ids = almacenIdentidades(almacen);
        ids.guardar(ana);
        ids.guardar(otra);
        expect(ids.leer('111111')).toEqual(ana);
        expect(ids.leer('222222')).toEqual(otra);
        expect(ids.leer()).toEqual(otra);
        expect(ids.leer('333333')).toBeNull();
        ids.borrar('222222');
        expect(ids.leer()).toBeNull();
        expect(ids.leer('111111')).toEqual(ana);
    });

    it('sobrevive a «cerrar la pestaña»: otra instancia sobre el mismo almacén la encuentra', () => {
        const almacen = almacenEnMemoria();
        almacenIdentidades(almacen).guardar(ana);
        expect(almacenIdentidades(almacen).leer('111111')).toEqual(ana);
    });

    it('borra las de más de 3 días al guardar una nueva, y tolera datos rotos', () => {
        const almacen = almacenEnMemoria();
        almacen.setItem('aula-quiz:jugador:999999', JSON.stringify({ ...ana, pin: '999999', guardada: Date.now() - 4 * 86_400_000 }));
        almacen.setItem('aula-quiz:jugador:888888', '{roto');
        almacen.setItem('otra-app:cosa', 'no se toca');
        almacenIdentidades(almacen).guardar(ana);
        expect(almacen.getItem('aula-quiz:jugador:999999')).toBeNull();
        expect(almacen.getItem('aula-quiz:jugador:888888')).toBeNull();
        expect(almacen.getItem('otra-app:cosa')).toBe('no se toca');
        expect(almacenIdentidades(almacen).leer('888888')).toBeNull();
    });
});
