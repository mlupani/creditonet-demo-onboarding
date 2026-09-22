const fs=require('fs');
const path='./src/data/creditos.json';
const db=JSON.parse(fs.readFileSync(path,'utf8'));

const nombres=[
 ["Agustín","Rojas"],["Florencia","Molina"],["Gabriel","Ortega"],["Carolina","Suárez"],["Diego","Luna"],
 ["Valeria","Cabrera"],["Facundo","Peña"],["Ximena","Campos"],["Renzo","Vega"],["Milagros","Navarro"],
 ["Ezequiel","Aguirre"],["Antonella","Rivas"],["Maximo","Gutiérrez"],["Priscila","Domínguez"],["Bautista","Moreno"],
 ["Candela","Peralta"],["Tomás","Romero"],["Ailén","Blanco"],["Ramiro","Sosa"],["Juliana","Paz"]
];
const bancos=["Banco Santander","Banco Galicia","Banco Macro","Banco Nación","Banco BBVA","Banco Provincia"];
const organismos=["empleados-salud","policia-provincial","municipales","docentes-provincial","jubilados-provincial"];
const estados = ["PREAPROBADO","ANALISIS_TOMADO","PARA_LIQUIDAR","RECHAZADO","OBSERVADO","EN_FIRMA","FIRMADO"];
const vendedores=["juan-perez","ana-torres","carlos-ruiz"];

function makeCbu(banco){
  const map={
    "Banco Santander":"0720",
    "Banco Galicia":"0070",
    "Banco Macro":"2850",
    "Banco Nación":"0110",
    "Banco BBVA":"0170",
    "Banco Provincia":"0140"
  };
  const pref=map[banco]||"0720";
  return pref + "00"+ String(Math.floor(Math.random()*1e14)).padStart(14,'0').slice(0,14);
}
function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}

const nuevos=[];
for(let i=0;i<20;i++){
  const [nombre,apellido]=nombres[i];
  const dni = `${31+Math.floor(i/7)}${String(2000000+ i*18473).slice(-7)}`.padStart(8,'0');
  const cuil = `20-${dni}-${i%10}`;
  const banco = bancos[i % bancos.length];
  const organismo = organismos[i % organismos.length];
  const vendedor = vendedores[i % vendedores.length];
  const estado = estados[i % estados.length];
  // For analista, etapa is ENVIADA except OBSERVADO is POST_OFERTA
  const etapa = estado==="OBSERVADO" ? "POST_OFERTA" : "ENVIADA";
  const numeroCredito = `CR-000${211+i}`;
  const numeroCliente = `01${String(1000+211+i).padStart(4,'0')}`;
  const fechaBase = `${String(5+ (i%20)).padStart(2,'0')}/09/2026`;
  const ingresoNeto = randomInt(800000,1500000);
  const ingresoBruto = Math.round(ingresoNeto*1.25);
  const laboral = {
    condicionLaboral: ["Empleado fijo","Contratado","Jubilado / Pensionado"][i%3],
    fechaInicioLaboral: `${String(1+i%28).padStart(2,'0')}/0${1+i%9}/201${5+i%5}`,
    empleadores: [{banco, cuit: `30-${String(80000000+i*12999).slice(-8)}-${i%10}`, razonSocial: `Empresa ${apellido} S.A.`}],
    ingresoBruto, ingresoNeto, disponible:0, debitosNoRemunerativos:0, extraccionesFecha:"", extraccionesImporte:0, transferenciasFecha:"", transferenciasImporte:0
  };
  const conOferta = true;
  const montoSolicitado = 900000 + i*80000;
  const plazo = [12,24,36,48,60][i%5];
  const tna = [58,67,72,75,78][i%5];
  const oferta = {
    planId:"linea-salud-2026", capitalMaximoBase:2500000, capitalMaximoRenovacion:2850000, capitalMaximoActual:2500000,
    montoSolicitado, plazo, tna, valorCuota: 70000 + i*2500, totalAPagar: montoSolicitado*1.5,
    primeraCuotaVencimiento:"10/11/2026", creditosActivos:[], deudaTerceros:{habilitado:false, entidad:"", importe:0, cbu:""}, aceptada:true
  };
  const postOferta = {
    precarga:{nombre, apellido, dni: dni.replace(/(\d{2})(\d{3})(\d{3})/,'$1.$2.$3'), banco},
    personales: {nacionalidad:"Argentina", estadoCivil:"Soltero/a", tipoVivienda:"Propietario", personasACargo:"1", tieneConyuge:"No"},
    laboral: {banco, [`cbu.${banco}`]: makeCbu(banco), cuitEmpleador:`30-${String(70000000+i*11111).slice(-8)}-9`, razonSocial:`Empresa ${apellido} S.A.`, rubro:"Salud"},
    tarjetas: [{id:"tarjeta-1", via:"PRESENCIAL", estado:"TOKENIZADA", verificada:true, enviadoA:null, tipo:"DEBITO", marca:"Visa", nombreTitular:`${nombre} ${apellido}`.toUpperCase(), primeros4:"4509", ultimos4:"1234", vencimiento:"11/29", emisor:banco, fechaTokenizacion:"Hoy 10:00", token:"tok_demo_XXXX", numeroCompleto:"4509000000001234", cvv:"123"}],
    referencias: [{id:"referencia-1", vinculo:"Familiar directo", dni:"30.111.222", nombre:"Carla", apellido:"Giménez", domicilio:{calle:"Av. Colón", numero:"1450", piso:"", departamento:"", provincia:"Córdoba", localidad:"Córdoba", codigoPostal:"5000"}, email:"carla@example.com", telefono:"351 6543210", autocompletado:true, condicionLaboral:"", ingresoBruto:0, ingresoNeto:0, reciboSueldo:[], otrosDocumentos:[], empleadorCalle:"", empleadorLocalidad:"", empleadorTelefono:"", banco:"", cbu:""}],
    garantes:[], legajo:{"dni-frente":[{id:"dni-frente-1", nombre:"dni_frente_1.jpg", detalle:"1.1 MB · Hoy 10:00"}], "dni-dorso":[{id:"dni-dorso-1", nombre:"dni_dorso_1.jpg", detalle:"1.0 MB · Hoy 10:00"}], "recibo-sueldo":[{id:"recibo-sueldo-1", nombre:"recibo_sueldo_1.jpg", detalle:"1.2 MB · Hoy 10:00"}]}, impresion:{accion:"IMPRESO", fecha:"Hoy 10:00"}
  };
  const riesgo = {
    estado:"COMPLETO", motorId:"motor-salud", escenario: i%3===0?"PASA_CON_MARCADAS":"PASA",
    reglas: estado==="OBSERVADO" ? [{id:"R01",codigo:"BCRA-01",nombre:"Situación BCRA",detalle:"Situación 2",fuente:"BCRA",valorEvaluado:"2",condicion:"<=2",bloqueante:false,resultado:"NO_PASA"}] : [{id:"R01",codigo:"BCRA-01",nombre:"Situación BCRA",detalle:"Situación 1 habilitada",fuente:"BCRA",valorEvaluado:"1",condicion:"<=2",bloqueante:true,resultado:"PASA"}],
    institucionales:[{id:"I01",codigo:"INST-01",nombre:"Edad mínima",detalle:"Mayor de 18",fuente:"Parámetros",valorEvaluado:"30 años",condicion:">=18",bloqueante:true,resultado:"PASA",momento:"IDENTIFICACION"}],
    resultado:"PASA", planId:"linea-salud-2026",
    limites:{
      capitalSolicitado: montoSolicitado, cuotasVigentes:0, cuotasLiberadas:0,
      limites:[
        {id:"universal",label:"Límite universal por cliente",detalle:"Exposición máxima",monto:5000000},
        {id:"brutos",label:"Límite por sueldos brutos",detalle:`3 sueldos brutos de $${ingresoBruto}`,monto: ingresoBruto*3},
        {id:"producto",label:"Límite por producto",detalle:"Préstamo personal",monto:4000000},
        {id:"plan",label:"Límite por plan de cuotas",detalle:"Línea Salud 2026",monto:2500000},
        {id:"cuota",label:"Límite por cuota máxima",detalle:"Relación cuota-ingreso",monto: Math.round(ingresoNeto*0.4)}
      ],
      limiteAplicadoId:"plan", capitalPorLimites:2500000,
      limitantes:[{id:"tipo-cliente",label:"Cliente existente",detalle:"Sin recorte",recortePct:0,aplica:true},{id:"condicion-laboral",label:"Condición laboral: Empleado fijo",detalle:"Sin recorte",recortePct:0,aplica:false},{id:"situacion-bcra",label:"Situación BCRA 1",detalle:"Sin recorte",recortePct:0,aplica:false}],
      recorteAplicadoPct:0, capitalConsiderado:2500000,
      limitesCuota:[
        {id:"smvm",label:"SMVM de bolsillo",detalle:`Ingreso neto $${ingresoNeto} menos mínimo $350.000`,monto: ingresoNeto-350000},
        {id:"rci",label:"Relación cuota-ingreso",detalle:"40 % del ingreso neto",monto: Math.round(ingresoNeto*0.4)},
        {id:"endeudamiento",label:"Nivel de endeudamiento",detalle:"50 % del bruto menos cuotas vigentes",monto: Math.round(ingresoBruto*0.5)}
      ],
      limiteCuotaAplicadoId:"rci", cuotaMaxima: Math.round(ingresoNeto*0.4)
    },
    evaluadoCon:{ingresoNeto, fechaNacimiento:"15/04/1990", genero:"Masculino"},
    fecha:"Hoy 10:00"
  };

  let observacion=null, rechazo=null, fechaEnvio=fechaBase, fechaAprob=null;
  if(estado==="OBSERVADO"){
    observacion={motivo:"Datos inconsistentes", nota:"Falta recibo de sueldo legible. Corregir legajo.", fecha:fechaBase, pantallas:["legajo"]};
  } else if(estado==="RECHAZADO"){
    rechazo={origen:"ANALISTA", codigos:["RA-03"], motivo:"Ingresos no verificables", observacion:"No se pudo verificar ingreso con empleador", fecha:fechaBase};
  } else if(estado==="PARA_LIQUIDAR" || estado==="EN_FIRMA" || estado==="FIRMADO"){
    fechaAprob=fechaBase;
  }

  const nuevo={
    _bandeja:"analista",
    _descripcion: `${estado} — ${estado==="PREAPROBADO"?"Pendiente toma": estado==="ANALISIS_TOMADO"?"En análisis tomado": estado==="PARA_LIQUIDAR"?"Aprobado para liquidar": estado==="RECHAZADO"?"Rechazado por analista": estado==="OBSERVADO"?"Observado":""} ${montoSolicitado}`,
    numeroCredito, numeroCliente, estado, etapa, tipoPersona:"FISICA",
    identificacion:{documento:dni, consultado:true, tipoCliente:"EXISTENTE", firmaRegistrada:null},
    cliente:{apellido, nombre, dni, cuil, genero: i%2===0?"Masculino":"Femenino", fechaNacimiento:"15/04/1990", calle:"Av. Colón", numero: String(2000+i), localidad:"Córdoba", provincia:"Córdoba", email:`${nombre.toLowerCase()}.${apellido.toLowerCase()}@email.com`, telefono:`351 ${6000000+i}`},
    situaciones:{bcra: i%4===0?2:1, interna:1},
    origenCampos:{apellido:"API pública", nombre:"API pública", dni:"API pública", cuil:"API pública", genero:"API pública", fechaNacimiento:"API pública", calle:"API pública", numero:"API pública", localidad:"API pública", provincia:"API pública", email:"Base interna"},
    identidadVerificada:true,
    configuracion:{productoId:"prestamo-personal", organismoId:organismo, canalId: i%2===0?"sucursal":"digital", vendedorId:vendedor},
    laboral, riesgo, oferta, postOferta,
    pantallasVisitadas: ["personales","laboral","tokenizacion","referencias","legajo","impresion"],
    analista:{tomado: estado==="ANALISIS_TOMADO", observacion, reenviada:false, pantallasCorregidas:[], cambioOfertaPendiente:null},
    rechazo, comentarios:[], fechaSolicitud:fechaBase, fechaPreaprobacion:fechaBase, fechaEnvioAnalisis:fechaEnvio, fechaAprobacion:fechaAprob
  };
  nuevos.push(nuevo);
}
db.creditos.push(...nuevos);
db.meta.total = db.creditos.length;
db.meta.bandejas.vendedor = db.creditos.filter(c=>c._bandeja==="vendedor").length;
db.meta.bandejas.analista = db.creditos.filter(c=>c._bandeja==="analista").length;
fs.writeFileSync(path, JSON.stringify(db,null,2),'utf8');
console.log('added analista',nuevos.length,'total',db.creditos.length,'vendedor',db.meta.bandejas.vendedor,'analista',db.meta.bandejas.analista);
