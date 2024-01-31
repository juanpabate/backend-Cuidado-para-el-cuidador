const express= require('express');
const mysql= require('mysql');
const cors= require('cors');

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



//ENDPOINT REGISTRAR USUARIO
app.post('/register', (req, res)=>{
  const {nombre, apellido, contrasena, email}= req.body;

  const sql= 'INSERT INTO usuarios (nombre, apellido, correo_electronico, contrasena) VALUES (?, ?, ?, ?)';
  db.query(sql, [nombre, apellido, contrasena, email], (err, result)=>{
    if(err){
      console.error('Error al insertar en la base de datos:', err);
      res.status(500).json({ success: false, error: 'Error al insertar en la base de datos' });
    }else{
      console.log('Usuario insertado correctamente');
      res.status(200).json({ success: true, message: 'Usuario registrado correctamente' });
    }
  })
});

//ENDPOINT DE LOGEO
app.post('/login', (req, res)=>{
  const {email, password}= req.body;

  const sql= 'SELECT * FROM usuarios WHERE correo_electronico= ? AND contrasena= ?';

  db.query(sql, [email, password], (err, result)=>{
    if(err){
      console.error('Error al verificar las credenciales', err);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }else{
      if (result.length > 0) {
        // Credenciales válidas
        const usuario= result[0];
        res.status(200).json({ success: true, message: 'Inicio de sesión exitoso', usuario });
      } else {
        // Credenciales no válidas
        res.status(401).json({ success: false, error: 'Credenciales no válidas desde el back' });
      }
    }
  })
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
