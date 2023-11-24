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
})


//ENDPOINT REGISTRAR USUARIO
app.post('/register', (req, res)=>{
  const {user, password, email}= req.body;

  const sql= 'INSERT INTO usuarios (nombre_usuario, contrasena, correo_electronico) VALUES (?, ?, ?)';
  db.query(sql, [user, password, email], (err, result)=>{
    if(err){
      console.error('Error al insertar en la base de datos:', err);
      res.status(500).json({ success: false, error: 'Error al insertar en la base de datos' });
    }else{
      console.log('Usuario insertado correctamente');
      res.status(200).json({ success: true, message: 'Usuario registrado correctamente' });
    }
  })
})

//ENDPOINT DE LOGEO
app.post('/login', (req, res)=>{
  const {user, password}= req.body;

  const sql= 'SELECT * FROM usuarios WHERE nombre_usuario= ? AND contrasena= ?';

  db.query(sql, [user, password], (err, result)=>{
    if(err){
      console.error('Error al verificar las credenciales', err);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }else{
      if (result.length > 0) {
        // Credenciales válidas
        res.status(200).json({ success: true, message: 'Inicio de sesión exitoso' });
      } else {
        // Credenciales no válidas
        res.status(401).json({ success: false, error: 'Credenciales no válidas' });
      }
    }
  })
})
