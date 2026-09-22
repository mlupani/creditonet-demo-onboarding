const fs=require('fs');
const path='./src/data/creditos.json';
const db=JSON.parse(fs.readFileSync(path,'utf8'));

const nombres=[
 ["Sofía","Martínez"],["Joaquín","López"],["Valentina","Rodríguez"],["Santiago","García"],["Camila","Fernández"],
 ["Mateo","González"],["Lucía","Pérez"],["Bruno","Sánchez"],["Martina","Ramírez"],["Thiago","Torres"],
 ["Julieta","Flores"],["Benjamín","Acosta"],["Mía","Herrera"],["Lautaro","Díaz"],["Emma","Ruiz"],
 ["Felipe","Morales"],["Delfina","Castro"],["Ignacio","Vargas"],["Paula","Silva"],["Nicolás","Méndez"]
];
const bancos=["Banco Santander","Banco Galicia","Banco Macro","Banco Nación","Banco BBVA","Banco Provincia"];
const organismos=["empleados-salud","policia-provincial","municipales","docentes-provincial"];
const vendedores=["juan-perez","ana-torres","carlos-ruiz"];
const productos=["prestamo-personal","credito-judicial","prestamo-prendario","adelanto-sueldo"];

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
  const idx=i;
  const [nombre,apellido]=nombres[i];
  const dni = `${30+Math.floor(i/10)}${String(1000000+ idx*12347).slice(-7)}`.slice(-8).padStart(8,'0');
  const cuil = `20-${dni}-`+ (i%10);
  const banco = bancos[i % bancos.length];
  const organismo = organismos[i % organismos.length];
  const vendedor = vendedores[i % vendedores.length];
  const producto = productos[i % productos.length];
  const estado = i < 5 ? "BORRADOR" : "EN_TRAMITE";
  const etapa = i < 5 ? "ORIGINACION" : (i < 12 ? "ORIGINACION" : "POST_OFERTA");
  const conOferta = i >= 12;
  const numeroCredito = `CR-000${191+i}`;
  const numeroCliente = `00${1000+191+i}`;
  const fechaSolicitud = conOferta || estado==="EN_TRAMITE" ? `${String(10+ (i%20)).padStart(2,'0')}/09/2026` : null;
  const tieneLaboral = i >=5;
  const ingresoNeto = tieneLaboral ? randomInt(700000,1400000) : 0;
  const ingresoBruto = tieneLaboral ? Math.round(ingresoNeto*1.25) : 0;
  const laboral = tieneLaboral ? {
    condicionLaboral: ["Empleado fijo","Contratado"][i%2],
    fechaInicioLaboral: `${String(1+i%28).padStart(2,'0')}/0${1+i%9}/201${5+i%5}`,
    empleadores: [{banco, cuit: `30-${String(70000000+i*12345).slice(-8)}-${i%10}`, razonSocial: `Empresa ${apellido} S.A.`}],
    ingresoBruto, ingresoNeto, disponible:0, debitosNoRemunerativos:0, extraccionesFecha:"", extraccionesImporte:0, transferenciasFecha:"", transferenciasImporte:0
  } : {
    condicionLaboral:"", fechaInicioLaboral:"", empleadores:[], ingresoBruto:0, ingresoNeto:0, disponible:0, debitosNoRemunerativos:0, extraccionesFecha:"", extraccionesImporte:0, transferenciasFecha:"", transferenciasImporte:0
  };
  const riesgo = conOferta ? {
    estado:"COMPLETO", motorId:"motor-salud", escenario:"PASA",
    reglas:[{id:"R01",codigo:"BCRA-01",nombre:"Situación BCRA",detalle:"Situación 1 habilitada",fuente:"BCRA",valorEvaluado:"1",condicion:"<=2",bloqueante:true,resultado:"PASA"}],
    institucionales:[{id:"I01",codigo:"INST-01",nombre:"Edad mínima",detalle:"Mayor de 18",fuente:"Parámetros",valorEvaluado:"30 años",condicion:">=18",bloqueante:true,resultado:"PASA",momento:"IDENTIFICACION"}],
    resultado:"PASA", planId:"linea-salud-2026",
    limites:{
      capitalSolicitado: Math.round(ingresoNeto*1.8/10000)*10000,
      cuotasVigentes:0, cuotasLiberadas:0,
      limites:[
        {id:"universal",label:"Límite universal por cliente",detalle:"Exposición máxima",monto:5000000},
        {id:"brutos",label:"Límite por sueldos brutos",detalle:`3 sueldos brutos de $${ingresoBruto}`,monto: ingresoBruto*3},
        {id:"producto",label:"Límite por producto",detalle:"Préstamo personal",monto:4000000},
        {id:"plan",label:"Límite por plan de cuotas",detalle:"Línea Salud 2026",monto:2500000},
        {id:"cuota",label:"Límite por cuota máxima",detalle:"Relación cuota-ingreso",monto: Math.round(ingresoNeto*0.4/10000)*10000}
      ],
      limiteAplicadoId:"plan", capitalPorLimites:2500000,
      limitantes:[
        {id:"tipo-cliente",label:"Cliente existente",detalle:"Sin recorte",recortePct:0,aplica:true},
        {id:"condicion-laboral",label:"Condición laboral: Empleado fijo",detalle:"Sin recorte",recortePct:0,aplica:false},
        {id:"situacion-bcra",label:"Situación BCRA 1",detalle:"Sin recorte",recortePct:0,aplica:false}
      ],
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
  } : {
    estado:"PENDIENTE",
    motorId:null, escenario:"PASA", reglas:[], institucionales:[], resultado:null, planId:null, limites:null, evaluadoCon:null, fecha:null
  };
  const oferta = conOferta ? {
    planId:"linea-salud-2026", capitalMaximoBase:2500000, capitalMaximoRenovacion:2850000, capitalMaximoActual:2500000,
    montoSolicitado: 800000 + i*75000, plazo: [12,24,36,48][i%4], tna: [58,67,72,75][i%4], valorCuota: 65000 + i*3000, totalAPagar: 1800000,
    primeraCuotaVencimiento:"10/11/2026", creditosActivos:[], deudaTerceros:{habilitado:false, entidad:"", importe:0, cbu:""}, aceptada: i%2===0
  } : {
    planId:null, capitalMaximoBase:2500000, capitalMaximoRenovacion:2850000, capitalMaximoActual:2500000,
    montoSolicitado:2500000, plazo:12, tna:58, valorCuota:0, totalAPagar:0, primeraCuotaVencimiento:"10/10/2026", creditosActivos:[], deudaTerceros:{habilitado:false, entidad:"", importe:0, cbu:""}, aceptada:false
  };
  const postLaboral = conOferta ? {banco, [`cbu.${banco}`]: makeCbu(banco)} : (tieneLaboral ? {banco} : {});
  const postOferta = etapa==="POST_OFERTA" ? {
    precarga: {nombre, apellido, dni: dni.replace(/(\d{2})(\d{3})(\d{3})/,'$1.$2.$3'), banco},
    personales: conOferta && i%3!==0 ? {nacionalidad:"Argentina", estadoCivil:"Soltero/a", tipoVivienda:"Propietario", personasACargo:"1", tieneConyuge:"No"} : {},
    laboral: postLaboral,
    tarjetas: conOferta && i%2===0 ? [{id:"tarjeta-1", via:"PRESENCIAL", estado:"TOKENIZADA", verificada:true, enviadoA:null, tipo:"DEBITO", marca:"Visa", nombreTitular:`${nombre} ${apellido}`.toUpperCase(), primeros4:"4509", ultimos4:"1234", vencimiento:"11/29", emisor:banco, fechaTokenizacion:"Hoy 10:00", token:"tok_demo_XXXX", numeroCompleto:"4509000000001234", cvv:"123"}] : [],
    referencias: conOferta && i%3!==1 ? [{id:"referencia-1", vinculo:"Familiar directo", dni:"30.111.222", nombre:"Carla", apellido:"Giménez", domicilio:{calle:"Av. Colón", numero:"1450", piso:"", departamento:"", provincia:"Córdoba", localidad:"Córdoba", codigoPostal:"5000"}, email:"carla@example.com", telefono:"351 6543210", autocompletado:true, condicionLaboral:"", ingresoBruto:0, ingresoNeto:0, reciboSueldo:[], otrosDocumentos:[], empleadorCalle:"", empleadorLocalidad:"", empleadorTelefono:"", banco:"", cbu:""}] : [],
    garantes:[], legajo: conOferta && i%4!==0 ? {"dni-frente":[{id:"dni-frente-1", nombre:"dni_frente_1.jpg", detalle:"1.1 MB · Hoy 10:00"}], "dni-dorso":[{id:"dni-dorso-1", nombre:"dni_dorso_1.jpg", detalle:"1.0 MB · Hoy 10:00"}]} : {}, impresion:null
  } : {
    precarga: tieneLaboral ? {banco} : {},
    personales:{}, laboral: tieneLaboral ? {banco} : {}, tarjetas:[], referencias:[], garantes:[], legajo:{}, impresion:null
  };

  const nuevo={
    _bandeja:"vendedor",
    _descripcion: conOferta ? `EN_TRAMITE POST-OFERTA — Oferta ${oferta.aceptada?'aceptada':'pendiente'} ${oferta.montoSolicitado} · ${oferta.plazo} cuotas` : (estado==="BORRADOR" ? "BORRADOR — Sin solicitar, falta completar originación" : "EN_TRAMITE ORIGINACION — Sin oferta, datos laborales completos"),
    numeroCredito: estado==="BORRADOR" ? null : numeroCredito,
    numeroCliente, estado, etapa, tipoPersona:"FISICA",
    identificacion:{documento:dni, consultado:true, tipoCliente:"EXISTENTE", firmaRegistrada:null},
    cliente:{apellido, nombre, dni, cuil, genero: i%2===0?"Masculino":"Femenino", fechaNacimiento:"15/04/1990", calle:"Av. Colón", numero: String(1000+i), localidad:"Córdoba", provincia:"Córdoba", email:`${nombre.toLowerCase()}.${apellido.toLowerCase()}@email.com`, telefono:`351 ${5000000+i}`},
    situaciones:{bcra:1, interna:1},
    origenCampos:{apellido:"API pública", nombre:"API pública", dni:"API pública", cuil:"API pública", genero:"API pública", fechaNacimiento:"API pública", calle:"API pública", numero:"API pública", localidad:"API pública", provincia:"API pública", email:"Base interna"},
    identidadVerificada: i>=5,
    configuracion:{productoId:producto, organismoId:organismo, canalId: i%2===0?"sucursal":"digital", vendedorId:vendedor},
    laboral, riesgo, oferta, postOferta,
    pantallasVisitadas: etapa==="POST_OFERTA" && conOferta ? ["personales","laboral"] : [],
    analista:{tomado:false, observacion:null, reenviada:false, pantallasCorregidas:[], cambioOfertaPendiente:null},
    rechazo:null, comentarios:[], fechaSolicitud, fechaPreaprobacion:null, fechaEnvioAnalisis:null, fechaAprobacion:null
  };
  nuevos.push(nuevo);
}
db.creditos.push(...nuevos);
db.meta.total = db.creditos.length;
db.meta.bandejas.vendedor = db.creditos.filter(c=>c._bandeja==="vendedor").length;
db.meta.bandejas.analista = db.creditos.filter(c=>c._bandeja==="analista").length;
fs.writeFileSync(path, JSON.stringify(db,null,2),'utf8');
console.log('added',nuevos.length,'total',db.creditos.length,'vendedor',db.meta.bandejas.vendedor);
