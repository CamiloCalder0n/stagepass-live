/** Clientes de ejemplo (personas ficticias). */
import { DocumentoCliente } from './BaseDatosMongoDummy';

export function semillaClientes(): DocumentoCliente[] {
  const creado = new Date('2026-09-01T12:00:00Z');
  return [
    { _id: 'CLI-0001', nombre_completo: 'Valentina Ríos Mejía', email: 'valentina.rios@correo.co', celular: '+573001112233', nacionalidad: 'Colombiana', creado_en: creado },
    { _id: 'CLI-0002', nombre_completo: 'Mateo Andrade Ruiz', email: 'mateo.andrade@correo.co', celular: '+573104445566', nacionalidad: 'Colombiana', creado_en: creado },
    { _id: 'CLI-0003', nombre_completo: 'Lucía Fernández Soto', email: 'lucia.fernandez@correo.es', celular: '+34611223344', nacionalidad: 'Española', creado_en: creado },
  ];
}
