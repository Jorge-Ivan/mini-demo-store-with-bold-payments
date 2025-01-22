## Ejecutar aplicativos

### Backend en Node con Nest.js
El Backend se encarga de generar el hash de integridad con la llave secreta y devolverla a la app Frontend.

Para iniciar la app ejecutar los siguientes comandos:
~~~Shell
cd ruta/dir/integrations-engineer-test #directorio del codigo
cd nest-shop #directorio backend
npm install #instalar depencias
npm run start
~~~

Debe crear un archivo de entorno .env en el directorio nest-shop si no existe, tome como ejemplo [.env.example](nest-shop/.env.example) para configurar la llave secreta.

Para instalar Nest.js ingrese [aquí](https://docs.nestjs.com/#installation)

### Frontend en Angular
El Frontend se encarga mostrar todos los productos y solicitar hash al bakend y ejecutar el boton Bold para continuar a pagar el carrito de compras.

Para iniciar la app ejecutar los siguientes comandos:
~~~Shell
cd ruta/dir/integrations-engineer-test #directorio del codigo
cd angular-shop #directorio frontend
npm install #instalar depencias
npm run start
~~~
La aplicacion se simulan en la url [http://my-local-shop.test:4200](http://my-local-shop.test:4200) una vez ambas esten ejecutando, este debe agregarse en el archivo de hosts.

Debe configurar el archivo de entorno src/enviroments/enviroment.ts en el directorio angular-shop si no existe.

Para instalar Angular Cli necesario para ejecutar la aplicación ingrese [aquí](https://angular.io/cli#installing-angular-cli)

### Notas
Las aplicaciones trabajan con Node v20.9.0 y Angular CLI: 17.3.7

#### Desarrollador por Jorge Ivan Carrillo