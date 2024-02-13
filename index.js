const express= require('express');
const mysql= require('mysql');
const cors= require('cors');
const bcrypt = require('bcrypt');

require('dotenv').config();

const app= express();
const port= process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.listen(port, '0.0.0.0', ()=>{
  console.log(`app escuchando en el puerto ${port}`);
});

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

db.connect((err)=>{
  if(err){
    console.error('Error al conectarse con la base de datos:', err);
  }else {
    console.log('Conexión exitosa a la base de datos');
  }
});


//ENDPOINT PARA OBTENER LOS USUARIOS
app.get('/usuarios', (req, res)=>{
  const sql = 'SELECT * FROM usuarios'

  db.query(sql, (err, result)=>{
    if(err){
      console.log('error al realizar la consulta ', err);
      res.status(500).send('Error interno del servidor');
    }else{
      res.json(result);
    }
  })
});

//ENDPOINT PARA OBTENER LAS PUBLICACIONES EN EL FORO
app.get('/foro/publicaciones', (req, res)=>{
  const sql = `
    SELECT
      publicaciones.IdPublicacion,
      publicaciones.TextoPublicacion,
      publicaciones.FechaPublicacion,
      usuarios.nombre,
      usuarios.apellido,
      usuarios.id AS IdUsuario,
      COUNT(respuestas.IdRespuesta) AS RespuestasCount
    FROM publicaciones
    JOIN usuarios ON publicaciones.IdUsuario = usuarios.Id
    LEFT JOIN respuestas ON publicaciones.IdPublicacion = respuestas.IdPublicacion
    GROUP BY
      publicaciones.IdPublicacion,
      publicaciones.TextoPublicacion,
      publicaciones.FechaPublicacion,
      usuarios.nombre,
      usuarios.apellido
    ORDER BY publicaciones.FechaPublicacion DESC;
  `;


  db.query(sql, (err, result)=>{
    if(err){
      console.log('error al realizar la consulta ', err);
      res.status(500).send('Error interno del servidor');
    }else{
      res.json(result);
    }
  })
});

// ENDPOINT PARA OBTENER PUBLICACIONES POR USUARIO
app.get('/foro/publicaciones/:usuarioId', (req, res) => {
  const { usuarioId } = req.params;

  const sql = `
    SELECT publicaciones.IdPublicacion, publicaciones.TextoPublicacion, publicaciones.FechaPublicacion, usuarios.nombre, usuarios.apellido, usuarios.id AS IdUsuario,
    COUNT(respuestas.IdRespuesta) AS RespuestasCount
    FROM publicaciones
    JOIN usuarios ON publicaciones.IdUsuario = usuarios.Id
    LEFT JOIN respuestas ON publicaciones.IdPublicacion = respuestas.IdPublicacion
    WHERE usuarios.Id = ?
    GROUP BY publicaciones.IdPublicacion, publicaciones.TextoPublicacion, publicaciones.FechaPublicacion, usuarios.nombre, usuarios.apellido
    ORDER BY publicaciones.FechaPublicacion DESC;
  `;

  db.query(sql, [usuarioId], (err, result) => {
    if (err) {
      console.log('error al realizar la consulta ', err);
      res.status(500).send('Error interno del servidor');
    } else {
      res.json(result);
    }
  });
});

// RUTA PARA AGREGAR NUEVA PUBLICACIÓN
app.post('/foro/publicar', (req, res) => {
  const { textoPublicacion, usuarioId } = req.body;

  const sql = 'INSERT INTO publicaciones (TextoPublicacion, IdUsuario) VALUES (?, ?)';

  db.query(sql, [textoPublicacion, usuarioId], (err, result) => {
    if (err) {
      console.error('Error al insertar nueva publicación:', err);
      res.status(500).json({ success: false, error: 'Error al insertar en la base de datos' });
    } else {
      console.log('Publicación insertada correctamente');
      res.status(200).json({ success: true, message: 'Publicación realizada correctamente' });
    }
  });
});

// ENDPOINT PATRA OBTENER LAS RESPUESTAS
app.post('/foro/respuestas', (req, res) => {
  const { idPublicacion } = req.body;

  if (!idPublicacion) {
    return res.status(400).json({ error: 'Se requiere el ID de la publicación' });
  }

  const sql = `
    SELECT respuestas.IdRespuesta, respuestas.TextoRespuesta, respuestas.FechaRespuesta,
           usuarios.Id AS IdUsuario, usuarios.nombre, usuarios.apellido
    FROM respuestas
    JOIN usuarios ON respuestas.IdUsuario = usuarios.Id
    WHERE respuestas.IdPublicacion = ?
    ORDER BY respuestas.FechaRespuesta ASC;
  `;

  db.query(sql, [idPublicacion], (err, result) => {
    if (err) {
      console.log('Error al obtener respuestas:', err);
      res.status(500).send('Error interno del servidor');
    } else {
      res.json(result);
    }
  });
});



// ENDPOINT PARA REGISTRAR USUARIO
app.post('/register', async (req, res) => {
  const { nombre, apellido, contrasena, email } = req.body;

  try {
    // Generar un hash de la contraseña antes de almacenarla en la base de datos
    const hashedPassword = await bcrypt.hash(contrasena, 10); // El segundo argumento es el costo del hash (salt)

    const sql = 'INSERT INTO usuarios (nombre, apellido, correo_electronico, contrasena) VALUES (?, ?, ?, ?)';
    db.query(sql, [nombre, apellido, email, hashedPassword], (err, result) => {
      if (err) {
        console.error('Error al insertar en la base de datos:', err);
        res.status(500).json({ success: false, error: 'Error al insertar en la base de datos' });
      } else {
        console.log('Usuario insertado correctamente');
        res.status(200).json({ success: true, message: 'Usuario registrado correctamente' });
      }
    });
  } catch (error) {
    console.error('Error al generar hash de contraseña:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ENDPOINT DE LOGEO
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Obtener el hash de la contraseña almacenada en la base de datos
    const sql = 'SELECT * FROM usuarios WHERE correo_electronico = ?';
    db.query(sql, [email], async (err, result) => {
      if (err) {
        console.error('Error al verificar las credenciales:', err);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      } else {
        if (result.length > 0) {
          // Usuario encontrado
          const usuario = result[0];
          const hashedPassword = usuario.contrasena;

          // Comparar la contraseña proporcionada con el hash almacenado
          const passwordMatch = await bcrypt.compare(password, hashedPassword);

          if (passwordMatch) {
            // Contraseña válida, inicio de sesión exitoso
            res.status(200).json({ success: true, message: 'Inicio de sesión exitoso', usuario });
          } else {
            // Contraseña incorrecta
            res.status(401).json({ success: false, error: 'Credenciales no válidas' });
          }
        } else {
          // Usuario no encontrado
          res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
      }
    });
  } catch (error) {
    console.error('Error al verificar las credenciales:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ENDPOINT PARA OBTENER FAVORITOS POR USUARIO
app.get('/favoritos/:usuarioId', (req, res) => {
  const { usuarioId } = req.params;

  console.log('ID de usuario recibido:', usuarioId);

  const sql = 'SELECT IdPublicacion FROM favoritos WHERE IdUsuario = ?';

  db.query(sql, [usuarioId], (err, result) => {
    if (err) {
      console.log('Error al obtener favoritos:', err);
      res.status(500).send('Error interno del servidor');
    } else {
      const favoritos = result.map((item) => item.IdPublicacion);
      res.json(favoritos);
    }
  });
});

// ENDPOINT PARA OBTENER POSTS DEL FORO GUARDADOS EN FAVORITOS
app.get('/foro/publicaciones/favoritos/:usuarioId', (req, res) => {
  const { usuarioId } = req.params;

  const sql = `
    SELECT publicaciones.IdPublicacion, publicaciones.TextoPublicacion, publicaciones.FechaPublicacion, usuarios.nombre, usuarios.apellido, usuarios.id AS IdUsuario,
    COUNT(respuestas.IdRespuesta) AS RespuestasCount
    FROM publicaciones
    JOIN usuarios ON publicaciones.IdUsuario = usuarios.Id
    LEFT JOIN respuestas ON publicaciones.IdPublicacion = respuestas.IdPublicacion
    JOIN favoritos ON publicaciones.IdPublicacion = favoritos.IdPublicacion
    WHERE favoritos.IdUsuario = ?
    GROUP BY publicaciones.IdPublicacion, publicaciones.TextoPublicacion, publicaciones.FechaPublicacion, usuarios.nombre, usuarios.apellido
    ORDER BY publicaciones.FechaPublicacion DESC;
  `;

  db.query(sql, [usuarioId], (err, result) => {
    if (err) {
      console.log('error al realizar la consulta ', err);
      res.status(500).send('Error interno del servidor');
    } else {
      res.json(result);
    }
  });
});


// ENDPOINT PARA MANEJAR FAVORITOS
app.post('/favoritos', (req, res) => {
  const { usuarioId, publicacionId } = req.body;

  if (!usuarioId || !publicacionId) {
    return res.status(400).json({ error: 'Se requiere el ID de usuario y el ID de publicación' });
  }

  // Verificar si ya existe la entrada en la tabla de favoritos
  const checkFavoritoQuery = 'SELECT * FROM favoritos WHERE IdUsuario = ? AND IdPublicacion = ?';
  db.query(checkFavoritoQuery, [usuarioId, publicacionId], (checkErr, checkResult) => {
    if (checkErr) {
      console.error('Error al verificar el favorito:', checkErr);
      return res.status(500).send('Error interno del servidor');
    }

    if (checkResult.length > 0) {
      // La entrada ya existe, por lo que eliminamos el favorito
      const deleteFavoritoQuery = 'DELETE FROM favoritos WHERE IdUsuario = ? AND IdPublicacion = ?';
      db.query(deleteFavoritoQuery, [usuarioId, publicacionId], (deleteErr, deleteResult) => {
        if (deleteErr) {
          console.error('Error al eliminar el favorito:', deleteErr);
          return res.status(500).send('Error interno del servidor');
        }

        res.status(200).json({ success: true, message: 'Favorito eliminado correctamente' });
      });
    } else {
      // La entrada no existe, por lo que la agregamos como favorito
      const addFavoritoQuery = 'INSERT INTO favoritos (IdUsuario, IdPublicacion) VALUES (?, ?)';
      db.query(addFavoritoQuery, [usuarioId, publicacionId], (addErr, addResult) => {
        if (addErr) {
          console.error('Error al agregar el favorito:', addErr);
          return res.status(500).send('Error interno del servidor');
        }

        res.status(200).json({ success: true, message: 'Favorito agregado correctamente' });
      });
    }
  });
});

// ENDPOINT PARA AGREGAR UNA NUEVA RESPUESTA
app.post('/foro/agregarRespuesta', (req, res) => {
  const { idPublicacion, idUsuario, textoRespuesta } = req.body;

  const sql = 'INSERT INTO respuestas (IdPublicacion, IdUsuario, TextoRespuesta) VALUES (?, ?, ?)';

  db.query(sql, [idPublicacion, idUsuario, textoRespuesta], (err, result) => {
    if (err) {
      console.error('Error al insertar nueva respuesta:', err);
      res.status(500).json({ success: false, error: 'Error al insertar en la base de datos' });
    } else {
      console.log('Respuesta insertada correctamente');
      res.status(200).json({ success: true, message: 'Respuesta almacenada correctamente' });
    }
  });
});

// ENDPOINT PARA ELIMINAR UNA PUBLICACIÓN DEL FORO Y SUS RESPUESTAS
app.delete('/foro/publicaciones/:postId', (req, res) => {
  const { postId } = req.params;

  if (!postId) {
    return res.status(400).json({ error: 'Se requiere el ID de la publicación' });
  }

  // Verificar si hay filas en la tabla favoritos asociadas a la publicación
  const checkFavoritosQuery = 'SELECT * FROM favoritos WHERE IdPublicacion = ?';

  db.query(checkFavoritosQuery, [postId], (checkFavoritosErr, checkFavoritosResult) => {
    if (checkFavoritosErr) {
      console.error('Error al verificar favoritos antes de eliminar:', checkFavoritosErr);
      return res.status(500).send('Error interno del servidor');
    }

    // Si hay filas en favoritos, se eliminan
    if (checkFavoritosResult.length > 0) {
      const deleteFavoritosQuery = 'DELETE FROM favoritos WHERE IdPublicacion = ?';

      db.query(deleteFavoritosQuery, [postId], (deleteFavoritosErr, deleteFavoritosResult) => {
        if (deleteFavoritosErr) {
          console.error('Error al eliminar filas en favoritos:', deleteFavoritosErr);
          res.status(500).send('Error interno del servidor');
        } else {
          console.log('Filas en favoritos eliminadas correctamente');
          // Ahora verificar y eliminar las respuestas y la publicación
          deleteRespuestasYPublicacion();
        }
      });
    } else {
      // No hay filas en favoritos, proceder directamente a verificar y eliminar las respuestas y la publicación
      console.log('No hay filas en favoritos para eliminar');
      deleteRespuestasYPublicacion();
    }
  });

  // Función para verificar y eliminar respuestas y publicación
  function deleteRespuestasYPublicacion() {
    // Verificar si hay respuestas asociadas a la publicación
    const checkRespuestasQuery = 'SELECT * FROM respuestas WHERE IdPublicacion = ?';
    db.query(checkRespuestasQuery, [postId], (checkErr, checkResult) => {
      if (checkErr) {
        console.error('Error al verificar respuestas antes de eliminar:', checkErr);
        return res.status(500).send('Error interno del servidor');
      }

      // Si hay respuestas, proceder a eliminarlas
      if (checkResult.length > 0) {
        const deleteRespuestasQuery = 'DELETE FROM respuestas WHERE IdPublicacion = ?';

        db.query(deleteRespuestasQuery, [postId], (err, result) => {
          if (err) {
            console.error('Error al eliminar respuestas:', err);
            res.status(500).send('Error interno del servidor');
          } else {
            console.log('Respuestas eliminadas correctamente');
            
            // Ahora, puedes proceder a eliminar la publicación
            const deletePostQuery = 'DELETE FROM publicaciones WHERE IdPublicacion = ?';

            db.query(deletePostQuery, [postId], (err, result) => {
              if (err) {
                console.error('Error al eliminar la publicación:', err);
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
              } else {
                if (result.affectedRows > 0) {
                  console.log('Publicación eliminada correctamente');
                  res.status(200).json({ success: true, message: 'Publicación eliminada correctamente' });
                } else {
                  res.status(404).json({ success: false, error: 'La publicación no existe' });
                }
              }
            });
          }
        });
      } else {
        // No hay respuestas, proceder a eliminar la publicación directamente
        console.log('No hay respuestas para eliminar');

        const deletePostQuery = 'DELETE FROM publicaciones WHERE IdPublicacion = ?';

        db.query(deletePostQuery, [postId], (err, result) => {
          if (err) {
            console.error('Error al eliminar la publicación:', err);
            res.status(500).json({ success: false, error: 'Error interno del servidor' });
          } else {
            if (result.affectedRows > 0) {
              console.log('Publicación eliminada correctamente');
              res.status(200).json({ success: true, message: 'Publicación eliminada correctamente' });
            } else {
              res.status(404).json({ success: false, error: 'La publicación no existe' });
            }
          }
        });
      }
    });
  }
});

// ENDPOINT PARA ELIMINAR UNA RESPUESTA
app.delete('/foro/eliminarRespuesta/:idRespuesta', (req, res) => {
  const idRespuesta= req.params.idRespuesta;

  const sql = 'DELETE FROM respuestas WHERE idRespuesta = ?';

  db.query(sql, [idRespuesta ], (err, result) => {
    if (err) {
      console.error('Error al eliminar la respuesta:', err);
      res.status(500).json({ success: false, error: 'Error al eliminar de la base de datos' });
    } else {
      console.log('Respuesta eliminada correctamente');
      res.status(200).json({ success: true, message: 'Respuesta almacenada correctamente' });
    }
  });
});

// ENDPOINT PARA EDITAR PUBLICACIÓN
app.put('/foro/editarPublicacion/:postId', (req, res) => {
  const { postId } = req.params;
  const { nuevoTexto } = req.body;

  if (!postId || !nuevoTexto) {
    return res.status(400).json({ error: 'Se requiere el ID de la publicación y el nuevo texto' });
  }

  const sql = 'UPDATE publicaciones SET TextoPublicacion = ? WHERE IdPublicacion = ?';

  db.query(sql, [nuevoTexto, postId], (err, result) => {
    if (err) {
      console.error('Error al editar la publicación:', err);
      res.status(500).json({ success: false, error: 'Error al actualizar en la base de datos' });
    } else {
      if (result.affectedRows > 0) {
        console.log('Publicación editada correctamente');
        res.status(200).json({ success: true, message: 'Publicación editada correctamente' });
      } else {
        res.status(404).json({ success: false, error: 'La publicación no existe' });
      }
    }
  });
});

// ENDPOINT PARA AGREGAR UNA NUEVA TAREA
app.post('/agregarTarea', (req, res) => {
  const { idUsuario, nombreTarea, Fecha, Hora, Lugar, Descripcion } = req.body;

  if (!idUsuario || !nombreTarea || !Fecha || !Hora || !Lugar || !Descripcion) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const sql = 'INSERT INTO tareas (idUsuario, nombreTarea, Fecha, Hora, Lugar, Descripcion) VALUES (?, ?, ?, ?, ?, ?)';

  db.query(sql, [idUsuario, nombreTarea, Fecha, Hora, Lugar, Descripcion], (err, result) => {
    if (err) {
      console.error('Error al insertar nueva tarea:', err);
      res.status(500).json({ success: false, error: 'Error al insertar en la base de datos' });
    } else {
      console.log('Tarea insertada correctamente');
      res.status(200).json({ success: true, message: 'Tarea agregada correctamente' });
    }
  });
});

// ENDPOINT PARA OBTENER TODAS LAS TAREAS DE UN USUARIO
app.get('/tareas/:idUsuario', (req, res) => {
  const { idUsuario } = req.params;

  // Obtener la fecha y hora actual
  const now = new Date();

  // Consulta SQL para obtener solo las tareas del usuario cuya fecha y hora son posteriores a la fecha y hora actuales
  const sql = 'SELECT * FROM tareas WHERE idUsuario = ? AND (Fecha > ? OR (Fecha = ? AND Hora > ?)) ORDER BY Fecha, Hora ASC';

  db.query(sql, [idUsuario, now, now, now], (err, result) => {
    if (err) {
      console.error('Error al obtener las tareas del usuario:', err);
      res.status(500).send('Error interno del servidor');
    } else {
      res.json(result);
    }
  });
});

// ENDPOINT PARA OBTENER LAS MEDICINAS DE UN USUARIO
app.get('/medicinas/:idUsuario', (req, res) => {
  const { idUsuario } = req.params;

  const sql = 'SELECT * FROM medicinas WHERE idUsuario = ?';

  db.query(sql, [idUsuario], (err, result) => {
    if (err) {
      console.error('Error al obtener las medicinas del usuario:', err);
      res.status(500).send('Error interno del servidor');
    } else {
      res.json(result);
    }
  });
});

// ENDPOINT PARA AGREGAR O ELIMINAR FECHA DE SUMINISTRO DE MEDICINA
app.post('/medicina/agregarEliminarFechaSuministro', (req, res) => {
  const { idMedicina, fechaHoy } = req.body;

  // Verificar si se proporcionó el idMedicina en la solicitud
  if (!idMedicina) {
    return res.status(400).json({ error: 'Se requiere el ID de la medicina' });
  }

  // Obtener la fecha de hoy
  // const fechaHoy = new Date().toISOString().slice(0, 10); // Formato YYYY-MM-DD
  console.log(fechaHoy);

  // Consultar la base de datos para obtener la medicina correspondiente
  const sqlSelectMedicina = 'SELECT * FROM medicinas WHERE idMedicina = ?';

  db.query(sqlSelectMedicina, [idMedicina], (err, result) => {
    if (err) {
      console.error('Error al obtener la medicina:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'La medicina no existe' });
    }

    // Obtener las fechas suministradas de la medicina
    const { fechaSuministrada } = result[0];
    let fechasSuministradas = fechaSuministrada ? fechaSuministrada.split(',') : [];

    // Verificar si la fecha de hoy ya está presente en la lista de fechas suministradas
    const indexFechaHoy = fechasSuministradas.indexOf(fechaHoy);
    if (indexFechaHoy !== -1) {
      // Si la fecha de hoy está presente, elimínala de la lista
      fechasSuministradas.splice(indexFechaHoy, 1);
    } else {
      // Si la fecha de hoy no está presente, agrégala a la lista
      fechasSuministradas.push(fechaHoy);
    }

    // Actualizar las fechas suministradas en la base de datos
    const sqlUpdateMedicina = 'UPDATE medicinas SET fechaSuministrada = ? WHERE idMedicina = ?';

    db.query(sqlUpdateMedicina, [fechasSuministradas.join(','), idMedicina], (updateErr, updateResult) => {
      if (updateErr) {
        console.error('Error al actualizar las fechas suministradas:', updateErr);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      console.log('Fechas suministradas actualizadas correctamente');
      return res.status(200).json({ message: 'Fechas suministradas actualizadas correctamente' });
    });
  });
});

// ENDPOINT PARA AGREGAR UNA NUEVA MEDICINA
app.post('/medicina/agregar', (req, res) => {
  const { idUsuario, nombreMedicina, fechaInicio, fechaFinalizacion, Lunes, Martes, Miercoles, Jueves, Viernes, Sabado, Domingo, hora } = req.body;

  if (!idUsuario || !nombreMedicina || !fechaInicio || hora === undefined || fechaFinalizacion === undefined ||
    Lunes === undefined || Martes === undefined || Miercoles === undefined || Jueves === undefined ||
    Viernes === undefined || Sabado === undefined || Domingo === undefined) {
    return res.status(400).json({ error: 'Se requieren todos los campos obligatorios para agregar una nueva medicina' });
  }

  // Consulta SQL para insertar la nueva medicina en la base de datos
  const sql = 'INSERT INTO medicinas (idUsuario, nombreMedicina, fechaInicio, fechaFinalizacion, Lunes, Martes, Miercoles, Jueves, Viernes, Sabado, Domingo, hora) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  // Ejecutar la consulta SQL
  db.query(sql, [idUsuario, nombreMedicina, fechaInicio, fechaFinalizacion, Lunes, Martes, Miercoles, Jueves, Viernes, Sabado, Domingo, hora], (err, result) => {
    if (err) {
      console.error('Error al insertar nueva medicina:', err);
      res.status(500).json({ success: false, error: 'Error al insertar en la base de datos' });
    } else {
      console.log('Medicina insertada correctamente');
      res.status(200).json({ success: true, message: 'Medicina agregada correctamente' });
    }
  });
});

