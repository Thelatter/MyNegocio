const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;




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
        SELECT *
        FROM cliente
    `);

    res.render('Clientes/Listar', {
        Clientes
    });
});

// ==========================
// EMPLEADOS
// ==========================

app.get('/empleados', async (req, res) => {

    const [Empleados] = await pool.query(`
        SELECT *
        FROM empleado
    `);

    res.render('Empleados/Listar', {
        Empleados
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

    const doc = new PDFDocument();

    res.setHeader(
        'Content-Type',
        'application/pdf'
    );

    doc.pipe(res);

    doc.fontSize(18)
       .text('REPORTE DE CATEGORIAS');

    doc.moveDown();

    Categorias.forEach(cat => {

        doc.text(
            `${cat.NombreCategoria} - ${cat.TotalProductos} productos`
        );

    });

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
    `, [id]);

    const [Categoria] = await pool.query(
        'SELECT NombreCategoria FROM categoria WHERE IdCategoria=?',
        [id]
    );

    const doc = new PDFDocument();

    res.setHeader(
        'Content-Type',
        'application/pdf'
    );

    doc.pipe(res);

    doc.fontSize(18)
       .text('CATALOGO POR CATEGORIA');

    doc.moveDown();

    doc.text(
        'Categoria: ' +
        Categoria[0].NombreCategoria
    );

    doc.moveDown();

    Productos.forEach(p => {

        doc.text(
            `${p.IdProducto} - ${p.NombreProducto}`
        );

        doc.text(
            `Precio: S/. ${p.PrecioUnidad}`
        );

        doc.text(
            `Stock: ${p.UnidadesEnExistencia}`
        );

        doc.text(
            `Descuento: ${p.Descuento}%`
        );

        doc.moveDown();

    });

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

    const doc = new PDFDocument();

    res.setHeader(
        'Content-Type',
        'application/pdf'
    );

    doc.pipe(res);

    doc.fontSize(18)
       .text('REPORTE DE PEDIDO');

    doc.moveDown();

    doc.text(
        `Pedido: ${Pedido[0].IdPedido}`
    );

    doc.text(
        `Cliente: ${Pedido[0].NombreEmpresa}`
    );

    doc.text(
        `Fecha: ${new Date(
            Pedido[0].FechaPedido
        ).toLocaleDateString('es-PE')}`
    );

    doc.moveDown();

    let total = 0;

    Detalles.forEach(d => {

        total += Number(d.Importe);

        doc.text(
            `${d.NombreProducto}
Cantidad: ${d.Cantidad}
Precio: ${d.PrecioUnidad}
Importe: ${d.Importe}`
        );

        doc.moveDown();

    });

    doc.text(
        `TOTAL: S/. ${total.toFixed(2)}`
    );

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
        Direccion
    )
    VALUES (?,?,?,?,?)`,
    [
        IdCliente,
        req.body.NombreEmpresa,
        req.body.Contacto,
        req.body.Telefono,
        req.body.Direccion
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

    res.render('Clientes/Editar', {
        Cliente: Cliente[0]
    });

});

app.post('/clientes/editar/:id', async (req, res) => {

    const id = req.params.id;

    await pool.query(
    `UPDATE cliente
     SET NombreEmpresa=?,
         Contacto=?,
         Telefono=?,
         Direccion=?
     WHERE IdCliente=?`,
    [
        req.body.NombreEmpresa,
        req.body.Contacto,
        req.body.Telefono,
        req.body.Direccion,
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
// SERVIDOR
// ==========================

app.listen(PORT, () => {

    console.log(
    `🚀 Servidor ejecutándose en el puerto ${PORT}`
);

});