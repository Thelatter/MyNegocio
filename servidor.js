const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const nodemailer = require("nodemailer");


const {
    encabezadoPDF,
    piePDF,
    tablaPDF,
    textoResumen
} = require('./utils/pdfReportes');


// ==========================
// CONFIGURACION
// ==========================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'Views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Public')));

// ==========================
// CONEXION MYSQL
// ==========================
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

//const pool = mysql.createPool({
 //   host: 'localhost',
 //   port: 3307,
  //  user: 'root',
  //  password: '12345',
  //  database: 'bdmynegocio',
   // waitForConnections: true,
   // connectionLimit: 10,
   // queueLimit: 0
//});

(async () => {
    try {
        const conn = await pool.getConnection();
        console.log('✅ MYSQL CONECTADO');
        conn.release();
    } catch (error) {
        console.error('❌ ERROR MYSQL');
        console.error(error);
    }
})();

// ==========================
// HOME
// ==========================

app.get('/', (req, res) => {
    res.render('Home');
});

// ==========================
// CONTACTO
// ==========================

app.get('/contacto', (req, res) => {
    res.render('Contacto');
});



// ==========================
// PRODUCTOS
// ==========================



// ==========================
// CLIENTES
// ==========================




app.get('/clientes', async (req, res) => {

    const [Clientes] = await pool.query(`
        SELECT
            c.*,
            p.NombrePais
        FROM cliente c
        LEFT JOIN pais p
        ON c.IdPais = p.IdPais
    `);

    const [Paises] = await pool.query(`
        SELECT *
        FROM pais
        ORDER BY NombrePais
    `);

    res.render('Clientes/Listar', {
        Clientes,
        Paises
    });
});



// ==========================
// BUSCAR PEDIDO
// ==========================

app.get('/pedidos/buscar', async (req, res) => {

    const [Pedidos] = await pool.query(`
        SELECT *
        FROM vistapedido
        ORDER BY IdPedido DESC
    `);

    res.render('Pedidos/BuscarPedido', {
        Pedidos,
        Detalles: []
    });

});

app.post('/pedidos/buscar', async (req, res) => {

    const texto = req.body.textoBusqueda;

    const [Pedidos] = await pool.query(
        `SELECT *
         FROM vistapedido
         WHERE CAST(IdPedido AS CHAR) LIKE ?
         OR NombreEmpresa LIKE ?`,
        [
            `%${texto}%`,
            `%${texto}%`
        ]
    );

    let Detalles = [];

    if (Pedidos.length > 0) {

        const [detalle] = await pool.query(
            `SELECT *
             FROM vistadetalle
             WHERE IdPedido=?`,
            [Pedidos[0].IdPedido]
        );

        Detalles = detalle;
    }

    res.render('Pedidos/BuscarPedido', {
        Pedidos,
        Detalles
    });

});
// ==========================
// REPORTES
// ==========================

// Categorias



app.get('/reportes/categorias/pdf', async (req, res) => {
    console.log('PDF CATEGORIAS CON UTILS EJECUTADO');
    const [Categorias] = await pool.query(`
        SELECT
            c.IdCategoria,
            c.NombreCategoria,
            COUNT(p.IdProducto) AS TotalProductos
        FROM categoria c
        LEFT JOIN producto p
        ON c.IdCategoria = p.IdCategoria
        GROUP BY
            c.IdCategoria,
            c.NombreCategoria
        ORDER BY c.NombreCategoria
    `);

    const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        'inline; filename="reporte_categorias.pdf"'
    );

    doc.pipe(res);

    encabezadoPDF(doc, 'Reporte de Categorías');

    const columnas = [
        {
            titulo: 'ID',
            campo: 'IdCategoria',
            x: 50,
            ancho: 70,
            align: 'center'
        },
        {
            titulo: 'Categoría',
            campo: 'NombreCategoria',
            x: 120,
            ancho: 280
        },
        {
            titulo: 'Total Productos',
            campo: 'TotalProductos',
            x: 400,
            ancho: 145,
            align: 'center'
        }
    ];

    const filas = Categorias.map(cat => ({
        IdCategoria: cat.IdCategoria,
        NombreCategoria: cat.NombreCategoria,
        TotalProductos: cat.TotalProductos
    }));

    let yFinal = tablaPDF(
        doc,
        columnas,
        filas,
        185
    );

    yFinal += 25;

    textoResumen(
        doc,
        `Total de categorías: ${Categorias.length}`,
        50,
        yFinal
    );

    piePDF(doc);

    doc.end();

});

app.get('/reportes/categorias', async (req, res) => {
    const [Categorias] = await pool.query(`
        SELECT
        c.IdCategoria,
        c.NombreCategoria,
        COUNT(p.IdProducto) AS TotalProductos
        FROM categoria c
        LEFT JOIN producto p
        ON c.IdCategoria=p.IdCategoria
        GROUP BY
        c.IdCategoria,
        c.NombreCategoria
    `);

    res.render('Reportes/Categorias', {
        Categorias
    });

});


app.get('/reportes/catalogo/pdf/:id', async (req, res) => {

    const id = req.params.id;

    const [Productos] = await pool.query(`
        SELECT
            IdProducto,
            NombreProducto,
            PrecioUnidad,
            UnidadesEnExistencia,
            Descuento
        FROM producto
        WHERE IdCategoria = ?
        ORDER BY NombreProducto
    `, [id]);

    const [Categoria] = await pool.query(
        'SELECT NombreCategoria FROM categoria WHERE IdCategoria=?',
        [id]
    );

    const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        'inline; filename="catalogo_categoria.pdf"'
    );

    doc.pipe(res);

    encabezadoPDF(doc, 'Catálogo por Categoría');

    doc.fillColor('#334155')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(
            'Categoría: ' + Categoria[0].NombreCategoria,
            50,
            165
        );

    const columnas = [
        {
            titulo: 'ID',
            campo: 'IdProducto',
            x: 50,
            ancho: 55,
            align: 'center'
        },
        {
            titulo: 'Producto',
            campo: 'NombreProducto',
            x: 105,
            ancho: 210
        },
        {
            titulo: 'Precio',
            campo: 'PrecioUnidad',
            x: 315,
            ancho: 85,
            align: 'center'
        },
        {
            titulo: 'Stock',
            campo: 'UnidadesEnExistencia',
            x: 400,
            ancho: 70,
            align: 'center'
        },
        {
            titulo: 'Descuento',
            campo: 'Descuento',
            x: 470,
            ancho: 75,
            align: 'center'
        }
    ];

    const filas = Productos.map(p => ({
        IdProducto: p.IdProducto,
        NombreProducto: p.NombreProducto,
        PrecioUnidad: `S/. ${Number(p.PrecioUnidad).toFixed(2)}`,
        UnidadesEnExistencia: p.UnidadesEnExistencia,
        Descuento: `${Number(p.Descuento).toFixed(2)}%`
    }));

    let yFinal = tablaPDF(
        doc,
        columnas,
        filas,
        200
    );

    yFinal += 25;

    textoResumen(
        doc,
        `Total de productos: ${Productos.length}`,
        50,
        yFinal
    );

    piePDF(doc);

    doc.end();

});


// Catalogo por categoria

app.get('/reportes/catalogo', async (req, res) => {

    const [Categorias] = await pool.query(`
        SELECT *
        FROM categoria
    `);

    res.render('Reportes/CatalogoCategoria', {
        Categorias,
        Productos: []
    });

});

app.post('/reportes/catalogo', async (req, res) => {

    const IdCategoria = req.body.IdCategoria;

    const [Categorias] = await pool.query(`
        SELECT *
        FROM categoria
    `);

    const [Productos] = await pool.query(`
        SELECT *
        FROM producto
        WHERE IdCategoria = ?
    `, [IdCategoria]);

    res.render('Reportes/CatalogoCategoria', {
        Categorias,
        Productos
    });

});

// Reporte pedidos

app.get('/reportes/pedidos', async (req, res) => {

    res.render('Reportes/ReportePedidos', {
        Pedidos: [],
        Detalles: []
    });

});


app.post('/reportes/pedidos', async (req, res) => {

    const texto = req.body.texto;

    const [Pedidos] = await pool.query(
        `
        SELECT *
        FROM vistapedido
        WHERE
        CAST(IdPedido AS CHAR) LIKE ?
        OR NombreEmpresa LIKE ?
        `,
        [
            `%${texto}%`,
            `%${texto}%`
        ]
    );

    let Detalles = [];

    if (Pedidos.length > 0) {

        const [D] = await pool.query(
            `
            SELECT *
            FROM vistadetalle
            WHERE IdPedido=?
            `,
            [Pedidos[0].IdPedido]
        );

        Detalles = D;
    }

    res.render('Reportes/ReportePedidos', {
        Pedidos,
        Detalles
    });

});

app.get(
'/reportes/pedidos/pdf/:id',
async (req, res) => {

    const id = req.params.id;

    const [Pedido] = await pool.query(
        `
        SELECT *
        FROM vistapedido
        WHERE IdPedido=?
        `,
        [id]
    );

    const [Detalles] = await pool.query(
        `
        SELECT *
        FROM vistadetalle
        WHERE IdPedido=?
        `,
        [id]
    );

    if (Pedido.length === 0) {
        return res.send('Pedido no encontrado');
    }

    const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `inline; filename="pedido_${id}.pdf"`
    );

    doc.pipe(res);

    encabezadoPDF(doc, 'Reporte de Pedido');

    let y = 170;

    doc.fillColor('#111827')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(`Pedido #${Pedido[0].IdPedido}`, 50, y);

    y += 35;

    doc.fillColor('#334155')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Cliente', 50, y);

    doc.font('Helvetica')
        .text(Pedido[0].NombreEmpresa, 50, y + 15);

    doc.font('Helvetica-Bold')
        .text('Fecha', 250, y);

    doc.font('Helvetica')
        .text(
            new Date(Pedido[0].FechaPedido).toLocaleDateString('es-PE'),
            250,
            y + 15
        );

    y += 55;

    celdaPDF(doc, 'Producto', 50, y, 190, 30, {
        fondo: '#1e293b',
        color: 'white',
        bold: true
    });

    celdaPDF(doc, 'Cantidad', 240, y, 80, 30, {
        fondo: '#1e293b',
        color: 'white',
        bold: true,
        align: 'center'
    });

    celdaPDF(doc, 'Precio', 320, y, 90, 30, {
        fondo: '#1e293b',
        color: 'white',
        bold: true,
        align: 'center'
    });

    celdaPDF(doc, 'Importe', 410, y, 140, 30, {
        fondo: '#1e293b',
        color: 'white',
        bold: true,
        align: 'center'
    });

    y += 30;

    let total = 0;

    Detalles.forEach((d, index) => {

        const fondo = index % 2 === 0 ? '#f8fafc' : 'white';

        total += Number(d.Importe);

        celdaPDF(doc, d.NombreProducto, 50, y, 190, 30, {
            fondo
        });

        celdaPDF(doc, String(d.Cantidad), 240, y, 80, 30, {
            fondo,
            align: 'center'
        });

        celdaPDF(
            doc,
            `S/. ${Number(d.PrecioUnidad).toFixed(2)}`,
            320,
            y,
            90,
            30,
            {
                fondo,
                align: 'center'
            }
        );

        celdaPDF(
            doc,
            `S/. ${Number(d.Importe).toFixed(2)}`,
            410,
            y,
            140,
            30,
            {
                fondo,
                align: 'center'
            }
        );

        y += 30;

    });

    y += 25;

    doc.fillColor('#059669')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(
            `TOTAL: S/. ${total.toFixed(2)}`,
            350,
            y,
            {
                width: 200,
                align: 'right'
            }
        );

    piePDF(doc);

    doc.end();

});



app.get('/clientes/nuevo', (req, res) => {

    res.render('Clientes/Nuevo');

});

// ==========================
// CRUD CLIENTES
// ==========================


app.post('/clientes/nuevo', async (req, res) => {

    const NombreEmpresa = req.body.NombreEmpresa;

    const [Max] = await pool.query(
        'SELECT MAX(IdCliente) AS Ultimo FROM cliente'
    );

    const IdCliente = (Max[0].Ultimo || 0) + 1;

    await pool.query(
`INSERT INTO cliente
(
    IdCliente,
    NombreEmpresa,
    Contacto,
    Telefono,
    Direccion,
    IdPais
)
VALUES (?,?,?,?,?,?)`,
[
    IdCliente,
    req.body.NombreEmpresa,
    req.body.Contacto,
    req.body.Telefono,
    req.body.Direccion,
    req.body.IdPais
]
);

    res.redirect('/clientes');

});

app.get('/clientes/editar/:id', async (req, res) => {

    const id = req.params.id;

    const [Cliente] = await pool.query(
        'SELECT * FROM cliente WHERE IdCliente=?',
        [id]
    );

    const [Paises] = await pool.query(`
        SELECT *
        FROM pais
        ORDER BY NombrePais
    `);

    res.render('Clientes/Editar', {
        Cliente: Cliente[0],
        Paises
    });

});

app.post('/clientes/editar/:id', async (req, res) => {

    const id = req.params.id;

    await pool.query(
`UPDATE cliente
 SET NombreEmpresa=?,
     Contacto=?,
     Telefono=?,
     Direccion=?,
     IdPais=?
 WHERE IdCliente=?`,
[
    req.body.NombreEmpresa,
    req.body.Contacto,
    req.body.Telefono,
    req.body.Direccion,
    req.body.IdPais,
    id
]
);

    res.redirect('/clientes');

});

app.get('/clientes/eliminar/:id', async (req, res) => {

    const id = req.params.id;

    const [Pedidos] = await pool.query(
        'SELECT * FROM pedido WHERE IdCliente=?',
        [id]
    );

    if (Pedidos.length > 0) {

    const alert = require('alert-node');

    alert(
    'No se puede eliminar el cliente porque tiene pedidos registrados.'
    );

    return res.redirect('/clientes');

}

    await pool.query(
        'DELETE FROM cliente WHERE IdCliente=?',
        [id]
    );

    res.redirect('/clientes');

});



// ==========================
// CRUD PRODUCTOS
// ==========================

// LISTAR

app.get('/productos', async (req, res) => {

    const [Productos] = await pool.query(`
        SELECT
            p.IdProducto,
            p.NombreProducto,
            c.NombreCategoria,
            p.CantidadPorUnidad,
            p.PrecioUnidad,
            p.UnidadesEnExistencia,
            p.Descuento,
            p.IdCategoria
        FROM producto p
        INNER JOIN categoria c
            ON p.IdCategoria = c.IdCategoria
    `);

    const [Categorias] = await pool.query(
        'SELECT * FROM categoria'
    );

    res.render('Productos/Listar', {
        Productos,
        Categorias
    });

});

// NUEVO

app.get('/productos/nuevo', async (req, res) => {

    const [Categorias] = await pool.query(
        'SELECT * FROM categoria'
    );

    res.render('Productos/Nuevo', {
        Categorias
    });

});

// GUARDAR

app.post('/productos/nuevo', async (req, res) => {

    const [Max] = await pool.query(
        'SELECT MAX(IdProducto) AS Ultimo FROM producto'
    );

    const IdProducto =
        (Max[0].Ultimo || 0) + 1;

    await pool.query(
        `INSERT INTO producto
        (
            IdProducto,
            NombreProducto,
            CantidadPorUnidad,
            PrecioUnidad,
            UnidadesEnExistencia,
            Descuento,
            IdCategoria
        )
        VALUES (?,?,?,?,?,?,?)`,
        [
            IdProducto,
            req.body.NombreProducto,
            req.body.CantidadPorUnidad,
            req.body.PrecioUnidad,
            req.body.UnidadesEnExistencia,
            req.body.Descuento,
            req.body.IdCategoria
        ]
    );

    res.redirect('/productos');

});

// EDITAR

app.get('/productos/editar/:id', async (req, res) => {

    const id = req.params.id;

    const [Producto] = await pool.query(
        'SELECT * FROM producto WHERE IdProducto=?',
        [id]
    );

    const [Categorias] = await pool.query(
        'SELECT * FROM categoria'
    );

    res.render('Productos/Editar', {
        Producto: Producto[0],
        Categorias
    });

});

// ACTUALIZAR

app.post('/productos/editar/:id', async (req, res) => {

    const id = req.params.id;

    await pool.query(
        `UPDATE producto
         SET NombreProducto=?,
             CantidadPorUnidad=?,
             PrecioUnidad=?,
             UnidadesEnExistencia=?,
             Descuento=?,
             IdCategoria=?
         WHERE IdProducto=?`,
        [
            req.body.NombreProducto,
            req.body.CantidadPorUnidad,
            req.body.PrecioUnidad,
            req.body.UnidadesEnExistencia,
            req.body.Descuento,
            req.body.IdCategoria,
            id
        ]
    );

    res.redirect('/productos');

});

// ELIMINAR

app.get('/productos/eliminar/:id', async (req, res) => {

    const id = req.params.id;

    const [Detalle] = await pool.query(
        'SELECT * FROM detalles_de_pedido WHERE IdProducto=?',
        [id]
    );

    if (Detalle.length > 0) {

        return res.send(
            'No se puede eliminar el producto porque tiene pedidos registrados.'
        );

    }

    await pool.query(
        'DELETE FROM producto WHERE IdProducto=?',
        [id]
    );

    res.redirect('/productos');

});




// ==========================
// CRUD EMPLEADOS
// ==========================

// LISTAR

app.get('/empleados', async (req, res) => {

    const [Empleados] = await pool.query(
        'SELECT * FROM empleado'
    );

    res.render('Empleados/Listar', {
        Empleados
    });

});

// NUEVO

app.get('/empleados/nuevo', (req, res) => {

    res.render('Empleados/Nuevo');

});

// GUARDAR

app.post('/empleados/nuevo', async (req, res) => {

    const [Max] = await pool.query(
        'SELECT MAX(IdEmpleado) AS Ultimo FROM empleado'
    );

    const IdEmpleado =
        (Max[0].Ultimo || 0) + 1;

    await pool.query(
        `INSERT INTO empleado
        (
            IdEmpleado,
            Nombres,
            Apellidos,
            Cargo,
            Telefono
        )
        VALUES (?,?,?,?,?)`,
        [
            IdEmpleado,
            req.body.Nombres,
            req.body.Apellidos,
            req.body.Cargo,
            req.body.Telefono
        ]
    );

    res.redirect('/empleados');

});

// EDITAR

app.get('/empleados/editar/:id', async (req, res) => {

    const id = req.params.id;

    const [Empleado] = await pool.query(
        'SELECT * FROM empleado WHERE IdEmpleado=?',
        [id]
    );

    res.render('Empleados/Editar', {
        Empleado: Empleado[0]
    });

});

// ACTUALIZAR

app.post('/empleados/editar/:id', async (req, res) => {

    const id = req.params.id;

    await pool.query(
        `UPDATE empleado
         SET Nombres=?,
             Apellidos=?,
             Cargo=?,
             Telefono=?
         WHERE IdEmpleado=?`,
        [
            req.body.Nombres,
            req.body.Apellidos,
            req.body.Cargo,
            req.body.Telefono,
            id
        ]
    );

    res.redirect('/empleados');

});

// ELIMINAR

app.get('/empleados/eliminar/:id', async (req, res) => {

    const id = req.params.id;

    const [Pedidos] = await pool.query(
        'SELECT * FROM pedido WHERE IdEmpleado=?',
        [id]
    );

    if (Pedidos.length > 0) {

        const alert = require('alert-node');

        alert(
            'No se puede eliminar el empleado porque tiene pedidos registrados.'
        );

        return res.redirect('/empleados');

    }

    await pool.query(
        'DELETE FROM empleado WHERE IdEmpleado=?',
        [id]
    );

    res.redirect('/empleados');

});

// ==========================
// PEDIDOS POR PAIS Y CLIENTE
// ==========================

app.get(
'/reportes/pedidos-pais-cliente',
async (req,res)=>{

    const [Paises] =
    await pool.query(`
        SELECT *
        FROM pais
        ORDER BY NombrePais
    `);

    res.render(
        'Reportes/PedidosPaisCliente',
        {
            Paises,
            Clientes: [],
            Pedidos: []
        }
    );

});

app.get(
'/clientes-por-pais/:id',
async (req,res)=>{

    const [Clientes] =
    await pool.query(
    `
    SELECT *
    FROM cliente
    WHERE IdPais=?
    ORDER BY NombreEmpresa
    `,
    [req.params.id]
    );

    res.json(Clientes);

});

app.post(
'/reportes/pedidos-pais-cliente',
async (req,res)=>{
    try{
        const IdPais =
            req.body.IdPais;

            const IdCliente =
            req.body.IdCliente;

            const [Paises] =
            await pool.query(`
                SELECT *
                FROM pais
            `);

            const [Clientes] =
            await pool.query(
            `
            SELECT *
            FROM cliente
            WHERE IdPais=?
            `,
            [IdPais]
            );

            const [Pedidos] =
            await pool.query(
            `
            SELECT
                p.IdPedido,
                p.FechaPedido,
                e.Nombres,
                e.Apellidos
            FROM pedido p
            INNER JOIN empleado e
            ON p.IdEmpleado = e.IdEmpleado
            WHERE p.IdCliente = ?
            ORDER BY p.FechaPedido DESC
            `,
            [IdCliente]
            );

            res.render(
                'Reportes/PedidosPaisCliente',
                {
                    Paises,
                    Clientes,
                    Pedidos,
                    IdPais,
                    IdCliente
                }
            );
    }catch(error){
        console.log(error);

    res.send(error.message);
    }
    

});


app.get('/prueba123', (req,res)=>{
    res.send('RUTA NUEVA FUNCIONANDO');
});


// ==========================
// DETALLE PEDIDO
// ==========================

app.get(
'/pedido/detalle/:id',
async (req,res)=>{

    const id = req.params.id;

    const [Pedido] =
    await pool.query(
    `
    SELECT
        p.IdPedido,
        p.FechaPedido,
        c.NombreEmpresa,
        e.Nombres,
        e.Apellidos
    FROM pedido p
    INNER JOIN cliente c
        ON p.IdCliente = c.IdCliente
    INNER JOIN empleado e
        ON p.IdEmpleado = e.IdEmpleado
    WHERE p.IdPedido = ?
    `,
    [id]
    );

    const [Detalles] =
    await pool.query(
    `
    SELECT
        d.IdProducto,
        pr.NombreProducto,
        d.Cantidad,
        d.PrecioUnidad,
        d.Descuento,
        (
            d.Cantidad *
            d.PrecioUnidad *
            (1-d.Descuento)
        ) AS Importe
    FROM detalles_de_pedido d
    INNER JOIN producto pr
        ON d.IdProducto = pr.IdProducto
    WHERE d.IdPedido = ?
    `,
    [id]
    );

    res.render(
        'Reportes/DetallePedido',
        {
            Pedido: Pedido[0],
            Detalles
        }
    );

});


app.get('/pedidos/nuevo', async (req, res) => {

    const [Clientes] = await pool.query(`
        SELECT
            IdCliente,
            NombreEmpresa
        FROM cliente
        ORDER BY NombreEmpresa
    `);

    const [Empleados] = await pool.query(`
        SELECT
            IdEmpleado,
            CONCAT(Nombres, ' ', Apellidos) AS Nombre
        FROM empleado
        ORDER BY Nombres
    `);

    const [Productos] = await pool.query(`
        SELECT
            IdProducto,
            NombreProducto,
            PrecioUnidad,
            Descuento,
            UnidadesEnExistencia
        FROM producto
        ORDER BY NombreProducto
    `);

    res.render('Pedidos/Nuevo', {
        Clientes,
        Empleados,
        Productos
    });

});

app.post('/pedidos/nuevo', async (req, res) => {

    const conexion = await pool.getConnection();

    try {

        const {
            IdCliente,
            IdEmpleado,
            FechaPedido
        } = req.body;

        let IdProducto = req.body.IdProducto;
        let Cantidad = req.body.Cantidad;

        // Si solo llega un producto, lo convertimos en arreglo
        if (!Array.isArray(IdProducto)) {
            IdProducto = [IdProducto];
            Cantidad = [Cantidad];
        }

        // Iniciar transacción
        await conexion.beginTransaction();

        // Obtener nuevo ID de pedido
        const [Max] = await conexion.query(`
            SELECT MAX(IdPedido) AS Ultimo
            FROM pedido
        `);

        const IdPedido = (Max[0].Ultimo || 0) + 1;

        // Guardar cabecera del pedido
        await conexion.query(`
            INSERT INTO pedido
            (
                IdPedido,
                IdCliente,
                IdEmpleado,
                FechaPedido
            )
            VALUES (?,?,?,?)
        `, [
            IdPedido,
            IdCliente,
            IdEmpleado,
            FechaPedido
        ]);

        // Guardar cada producto en detalles_de_pedido
        for (let i = 0; i < IdProducto.length; i++) {

            const idProd = IdProducto[i];
            const cant = Number(Cantidad[i]);

            if (!idProd || cant <= 0) {
                continue;
            }

            const [Producto] = await conexion.query(`
                SELECT
                    PrecioUnidad,
                    Descuento,
                    UnidadesEnExistencia
                FROM producto
                WHERE IdProducto = ?
            `, [idProd]);

            if (Producto.length === 0) {
                throw new Error(`Producto no encontrado: ${idProd}`);
            }

            const PrecioUnidad = Producto[0].PrecioUnidad;
            const Descuento = Producto[0].Descuento || 0;
            const StockActual = Producto[0].UnidadesEnExistencia;

            if (cant > StockActual) {
                throw new Error(
                    `Stock insuficiente para el producto ${idProd}. Stock disponible: ${StockActual}`
                );
            }

            await conexion.query(`
                INSERT INTO detalles_de_pedido
                (
                    IdPedido,
                    IdProducto,
                    PrecioUnidad,
                    Cantidad,
                    Descuento
                )
                VALUES (?,?,?,?,?)
            `, [
                IdPedido,
                idProd,
                PrecioUnidad,
                cant,
                Descuento
            ]);

            await conexion.query(`
                UPDATE producto
                SET UnidadesEnExistencia = UnidadesEnExistencia - ?
                WHERE IdProducto = ?
            `, [
                cant,
                idProd
            ]);
        }

        await conexion.commit();

        res.redirect('/pedidos/buscar');

    } catch (error) {

        await conexion.rollback();

        console.error('ERROR AL GUARDAR PEDIDO:');
        console.error(error);

        res.send(`
            <h2>Error al guardar pedido</h2>
            <p>${error.message}</p>
            <a href="/pedidos/nuevo">Volver</a>
        `);

    } finally {

        conexion.release();

    }

});

// ==========================
// EMPLEO
// ==========================

app.get('/empleo', async (req, res) => {

    try {

        console.log('ENTRANDO A /empleo');

        const [Empresas] = await pool.query(`
            SELECT *
            FROM empresa_empleo
            ORDER BY RazonSocial
        `);

        console.log('EMPRESAS ENCONTRADAS:', Empresas.length);

        res.send(`
    <h1>Empleo funcionando</h1>
    <p>Empresas encontradas: ${Empresas.length}</p>
`);

    } catch (error) {

        console.error('ERROR EN /empleo:');
        console.error(error);

        res.send(`
            <h1>Error en /empleo</h1>
            <p>${error.message}</p>
            <a href="/">Volver al inicio</a>
        `);

    }

});

app.post('/empleo/buscar-empresa', async (req, res) => {

    const IdEmpresa = req.body.IdEmpresa;

    const [Empresas] = await pool.query(`
        SELECT *
        FROM empresa_empleo
        ORDER BY RazonSocial
    `);

    const [Empresa] = await pool.query(`
        SELECT *
        FROM empresa_empleo
        WHERE IdEmpresa = ?
    `, [IdEmpresa]);

    const [Ofertas] = await pool.query(`
        SELECT *
        FROM oferta_empleo
        WHERE IdEmpresa = ?
        ORDER BY IdOferta
    `, [IdEmpresa]);

    res.render('Empleo/Index', {
        Empresas,
        Empresa: Empresa[0] || null,
        Ofertas,
        Oferta: null,
        Conocimientos: [],
        mensaje: null
    });

});

app.post('/empleo/buscar-oferta', async (req, res) => {

    const IdOferta = req.body.IdOferta;

    const [Empresas] = await pool.query(`
        SELECT *
        FROM empresa_empleo
        ORDER BY RazonSocial
    `);

    const [Oferta] = await pool.query(`
        SELECT
            o.*,
            e.RazonSocial,
            e.Direccion,
            e.Distrito
        FROM oferta_empleo o
        INNER JOIN empresa_empleo e
        ON o.IdEmpresa = e.IdEmpresa
        WHERE o.IdOferta = ?
    `, [IdOferta]);

    if (Oferta.length === 0) {
        return res.render('Empleo/Index', {
            Empresas,
            Empresa: null,
            Ofertas: [],
            Oferta: null,
            Conocimientos: [],
            mensaje: 'No se encontró la oferta de empleo'
        });
    }

    const [Empresa] = await pool.query(`
        SELECT *
        FROM empresa_empleo
        WHERE IdEmpresa = ?
    `, [Oferta[0].IdEmpresa]);

    const [Ofertas] = await pool.query(`
        SELECT *
        FROM oferta_empleo
        WHERE IdEmpresa = ?
        ORDER BY IdOferta
    `, [Oferta[0].IdEmpresa]);

    const [Conocimientos] = await pool.query(`
        SELECT *
        FROM oferta_conocimiento
        WHERE IdOferta = ?
    `, [IdOferta]);

    res.render('Empleo/Index', {
        Empresas,
        Empresa: Empresa[0],
        Ofertas,
        Oferta: Oferta[0],
        Conocimientos,
        mensaje: null
    });

});

app.post('/empleo/crear', async (req, res) => {

    const conexion = await pool.getConnection();

    try {

        await conexion.beginTransaction();

        const {
            IdEmpresa,
            RazonSocial,
            Direccion,
            Distrito,
            IdOferta,
            Puesto,
            Experiencia,
            PagoMes,
            Formacion,
            Conocimientos
        } = req.body;

        await conexion.query(`
            INSERT INTO empresa_empleo
            (
                IdEmpresa,
                RazonSocial,
                Direccion,
                Distrito
            )
            VALUES (?,?,?,?)
        `, [
            IdEmpresa,
            RazonSocial,
            Direccion,
            Distrito
        ]);

        await conexion.query(`
            INSERT INTO oferta_empleo
            (
                IdOferta,
                IdEmpresa,
                Puesto,
                Experiencia,
                PagoMes,
                Formacion
            )
            VALUES (?,?,?,?,?,?)
        `, [
            IdOferta,
            IdEmpresa,
            Puesto,
            Experiencia,
            PagoMes,
            Formacion
        ]);

        const listaConocimientos = Conocimientos
            .split(',')
            .map(c => c.trim())
            .filter(c => c !== '');

        for (const conocimiento of listaConocimientos) {
            await conexion.query(`
                INSERT INTO oferta_conocimiento
                (
                    IdOferta,
                    Conocimiento
                )
                VALUES (?,?)
            `, [
                IdOferta,
                conocimiento
            ]);
        }

        await conexion.commit();

        res.redirect('/empleo');

    } catch (error) {

        await conexion.rollback();

        res.send(`
            <h2>Error al crear empresa y oferta</h2>
            <p>${error.message}</p>
            <a href="/empleo">Volver</a>
        `);

    } finally {

        conexion.release();

    }

});

app.post('/empleo/agregar-oferta', async (req, res) => {

    const conexion = await pool.getConnection();

    try {

        await conexion.beginTransaction();

        const {
            IdEmpresa,
            IdOferta,
            Puesto,
            Experiencia,
            PagoMes,
            Formacion,
            Conocimientos
        } = req.body;

        await conexion.query(`
            INSERT INTO oferta_empleo
            (
                IdOferta,
                IdEmpresa,
                Puesto,
                Experiencia,
                PagoMes,
                Formacion
            )
            VALUES (?,?,?,?,?,?)
        `, [
            IdOferta,
            IdEmpresa,
            Puesto,
            Experiencia,
            PagoMes,
            Formacion
        ]);

        const listaConocimientos = Conocimientos
            .split(',')
            .map(c => c.trim())
            .filter(c => c !== '');

        for (const conocimiento of listaConocimientos) {
            await conexion.query(`
                INSERT INTO oferta_conocimiento
                (
                    IdOferta,
                    Conocimiento
                )
                VALUES (?,?)
            `, [
                IdOferta,
                conocimiento
            ]);
        }

        await conexion.commit();

        res.redirect('/empleo');

    } catch (error) {

        await conexion.rollback();

        res.send(`
            <h2>Error al agregar oferta</h2>
            <p>${error.message}</p>
            <a href="/empleo">Volver</a>
        `);

    } finally {

        conexion.release();

    }

});

app.post('/empleo/actualizar', async (req, res) => {

    const conexion = await pool.getConnection();

    try {

        await conexion.beginTransaction();

        const {
            IdEmpresa,
            RazonSocial,
            Direccion,
            Distrito,
            IdOferta,
            Puesto,
            Experiencia,
            PagoMes,
            Formacion,
            Conocimientos
        } = req.body;

        await conexion.query(`
            UPDATE empresa_empleo
            SET
                RazonSocial = ?,
                Direccion = ?,
                Distrito = ?
            WHERE IdEmpresa = ?
        `, [
            RazonSocial,
            Direccion,
            Distrito,
            IdEmpresa
        ]);

        await conexion.query(`
            UPDATE oferta_empleo
            SET
                Puesto = ?,
                Experiencia = ?,
                PagoMes = ?,
                Formacion = ?
            WHERE IdOferta = ?
        `, [
            Puesto,
            Experiencia,
            PagoMes,
            Formacion,
            IdOferta
        ]);

        await conexion.query(`
            DELETE FROM oferta_conocimiento
            WHERE IdOferta = ?
        `, [IdOferta]);

        const listaConocimientos = Conocimientos
            .split(',')
            .map(c => c.trim())
            .filter(c => c !== '');

        for (const conocimiento of listaConocimientos) {
            await conexion.query(`
                INSERT INTO oferta_conocimiento
                (
                    IdOferta,
                    Conocimiento
                )
                VALUES (?,?)
            `, [
                IdOferta,
                conocimiento
            ]);
        }

        await conexion.commit();

        res.redirect('/empleo');

    } catch (error) {

        await conexion.rollback();

        res.send(`
            <h2>Error al actualizar</h2>
            <p>${error.message}</p>
            <a href="/empleo">Volver</a>
        `);

    } finally {

        conexion.release();

    }

});

app.post('/empleo/eliminar-empresa', async (req, res) => {

    const IdEmpresa = req.body.IdEmpresa;

    await pool.query(`
        DELETE FROM empresa_empleo
        WHERE IdEmpresa = ?
    `, [IdEmpresa]);

    res.redirect('/empleo');

});

app.post('/empleo/eliminar-oferta', async (req, res) => {

    const IdOferta = req.body.IdOferta;

    await pool.query(`
        DELETE FROM oferta_empleo
        WHERE IdOferta = ?
    `, [IdOferta]);

    res.redirect('/empleo');

});
// ==========================
// SERVIDOR
// ==========================


app.listen(PORT, () => {

    console.log(
    `🚀 Servidor ejecutándose en el puerto ${PORT}`
);

});