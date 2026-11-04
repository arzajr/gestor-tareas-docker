// Creamos el array de tareas
const tareas = [];

// Creamos constantes para trabajar con botones, <ul> e <input>
const inputTarea = document.querySelector("#inputTarea");
const añadirTarea = document.querySelector("#añadirTarea");
const listaTareas = document.querySelector("#listaTareas");

// Evento para crear la tarea que teclea el usuario
añadirTarea.addEventListener("click", function () {

    // Si el usuario deja el campo vacío o con espacios, no hace nada
    if (inputTarea.value.trim() === "") {
        alert("Escribe una tarea antes de añadirla.")

        // Continuamos    
    } else {
        // Creamos un objeto con la tarea
        const nuevaTarea = {
            nombre: inputTarea.value.trim(),
            completada: false
        }
        // Añadimos la nueva tarea al array de tareas
        tareas.push(nuevaTarea);



        // Representar las tareas dentro del HTML, creamos el <li>
        const elementoTarea = document.createElement("li");
        const label = document.createElement("label");

        // Creamos el checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = nuevaTarea.completada;

        // Hacemos que al marcar el checkbox cambie el estado del objeto
        checkbox.addEventListener("click", function () {
            nuevaTarea.completada = !nuevaTarea.completada;

            // Si la tarea está completada, tacharla, sino no
            if (nuevaTarea.completada) {
                elementoTarea.classList.add("completada");
            } else {
                elementoTarea.classList.remove("completada");
            }
        });

        // Añadimos checkbox al <li>
        label.appendChild(checkbox);



        // Creamos el texto con el nombre de la nueva tarea
        const textoTarea = document.createTextNode(nuevaTarea.nombre);

        // Añadimos al elemento de la tarea el checkbox
        label.appendChild(textoTarea);



        // Creamos el botón de eliminar
        const botonEliminar = document.createElement("button");
        botonEliminar.textContent = "Eliminar";

        // Evento del botón eliminar
        botonEliminar.addEventListener("click", function () {

            // Confirmar borrado
            const confirmar = confirm(
                "¿Estás seguro de que quieres eliminar " + nuevaTarea.nombre + " ?"
            );

            // Borrado del <li>
            if (confirmar) {
                elementoTarea.remove();

                // Borrado del array
                const indice = tareas.indexOf(nuevaTarea);
                tareas.splice(indice, 1);
            }
        })

        elementoTarea.appendChild(label);

        // Lo añadimos al li
        elementoTarea.appendChild(botonEliminar);



        // Añadimos el elemento a la lista de tareas 
        listaTareas.appendChild(elementoTarea);



        // Vacíamos el campo de texto
        inputTarea.value = "";
    }

});



