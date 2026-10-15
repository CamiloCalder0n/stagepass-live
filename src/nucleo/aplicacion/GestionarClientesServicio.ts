/**
 * NÚCLEO › APLICACIÓN — Caso de uso: registrar y consultar clientes.
 */
import { DatosInvalidosError, RecursoNoEncontradoError } from '../dominio/excepciones/errores';
import { Cliente, DatosCliente } from '../dominio/modelo/Cliente';
import { GestionarClientesCasoUso } from '../puertos/entrada/GestionarClientesCasoUso';
import { GeneradorIdentificadores } from '../puertos/salida/GeneradorIdentificadores';
import { RepositorioClientes } from '../puertos/salida/RepositorioClientes';

export class GestionarClientesServicio implements GestionarClientesCasoUso {
  constructor(
    private readonly clientes: RepositorioClientes,
    private readonly identificadores: GeneradorIdentificadores
  ) {}

  async registrar(datos: DatosCliente): Promise<Cliente> {
    const cliente = new Cliente(this.identificadores.nuevoId('CLI'), datos);
    if (await this.clientes.buscarPorCorreo(cliente.correo)) {
      throw new DatosInvalidosError(`Ya existe un cliente registrado con el correo ${cliente.correo}.`);
    }
    await this.clientes.guardar(cliente);
    return cliente;
  }

  async obtener(clienteId: string): Promise<Cliente> {
    const cliente = await this.clientes.buscarPorId(clienteId);
    if (!cliente) throw new RecursoNoEncontradoError('Cliente', clienteId);
    return cliente;
  }

  listar(): Promise<Cliente[]> {
    return this.clientes.listar();
  }
}
