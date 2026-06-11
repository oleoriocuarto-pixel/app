Aplicacion de Recordatorios

Como iniciarla:
Opcion facil:
1. Hacer doble click en iniciar-recordatorios.bat
2. En esta computadora abrir:
   http://localhost:4173

Opcion por terminal:
1. Abrir una terminal en esta carpeta.
2. Ejecutar:
   node server.js
3. Abrir:
   http://localhost:4173

Para usarla desde otro dispositivo de la misma red:
1. Averiguar la IP de esta computadora.
2. Abrir en el celular u otra PC:
   http://IP-DE-ESTA-PC:4173

Los datos se guardan automaticamente en:
data/reminders.json

Para que funcione desde cualquier lugar de internet, hay que subir esta app a un servidor o hosting.

Para hosting con disco persistente:
- Comando de inicio: npm start
- Variable opcional DATA_DIR: carpeta donde guardar reminders.json
- Si el proveedor permite montar un disco, usar DATA_DIR apuntando a ese disco.
