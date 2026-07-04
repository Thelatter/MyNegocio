// ==========================
// ESTILOS PDF MYNEGOCIO
// ==========================

function encabezadoPDF(doc, titulo) {

    // Franja superior
    doc.rect(0, 0, doc.page.width, 80)
        .fill('#1e293b');

    // Nombre del sistema
    doc.fillColor('white')
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('MyNegocio', 50, 22);

    // Subtítulo
    doc.font('Helvetica')
        .fontSize(10)
        .text('Sistema de Gestión Empresarial', 50, 50);

    // Título del reporte
    doc.fillColor('#1e293b')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(titulo, 50, 110);

    // Fecha
    doc.fillColor('#64748b')
        .font('Helvetica')
        .fontSize(10)
        .text(
            'Fecha de generación: ' + new Date().toLocaleDateString('es-PE'),
            50,
            138
        );

    // Línea separadora
    doc.moveTo(50, 160)
        .lineTo(545, 160)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke();
}

function piePDF(doc) {

    const y = doc.page.height - 55;

    doc.moveTo(50, y - 10)
        .lineTo(545, y - 10)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke();

    doc.fillColor('#64748b')
        .font('Helvetica')
        .fontSize(9)
        .text('MyNegocio - Reporte generado automáticamente', 50, y);

    doc.text(
        'Página 1',
        480,
        y,
        {
            width: 65,
            align: 'right'
        }
    );
}

function celdaPDF(doc, texto, x, y, ancho, alto, opciones = {}) {

    const fondo = opciones.fondo || null;
    const color = opciones.color || '#111827';
    const size = opciones.size || 10;
    const bold = opciones.bold || false;
    const align = opciones.align || 'left';

    if (fondo) {
        doc.rect(x, y, ancho, alto)
            .fill(fondo);
    }

    doc.rect(x, y, ancho, alto)
        .strokeColor('#d1d5db')
        .lineWidth(0.6)
        .stroke();

    doc.fillColor(color)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(size)
        .text(
            String(texto),
            x + 6,
            y + 8,
            {
                width: ancho - 12,
                align
            }
        );
}

function tablaPDF(doc, columnas, filas, inicioY) {

    let y = inicioY;

    // Encabezados
    columnas.forEach(col => {
        celdaPDF(
            doc,
            col.titulo,
            col.x,
            y,
            col.ancho,
            30,
            {
                fondo: '#1e293b',
                color: 'white',
                bold: true,
                align: col.align || 'left'
            }
        );
    });

    y += 30;

    // Filas
    filas.forEach((fila, index) => {

        const fondo = index % 2 === 0 ? '#f8fafc' : 'white';

        columnas.forEach(col => {

            celdaPDF(
                doc,
                fila[col.campo],
                col.x,
                y,
                col.ancho,
                30,
                {
                    fondo,
                    align: col.align || 'left'
                }
            );

        });

        y += 30;

        // Salto de página simple
        if (y > 720) {

            piePDF(doc);
            doc.addPage();

            encabezadoPDF(doc, 'Continuación del Reporte');

            y = 180;

            columnas.forEach(col => {
                celdaPDF(
                    doc,
                    col.titulo,
                    col.x,
                    y,
                    col.ancho,
                    30,
                    {
                        fondo: '#1e293b',
                        color: 'white',
                        bold: true,
                        align: col.align || 'left'
                    }
                );
            });

            y += 30;
        }

    });

    return y;
}

function textoResumen(doc, texto, x, y) {

    doc.fillColor('#059669')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(
            texto,
            x,
            y
        );
}

module.exports = {
    encabezadoPDF,
    piePDF,
    celdaPDF,
    tablaPDF,
    textoResumen
};