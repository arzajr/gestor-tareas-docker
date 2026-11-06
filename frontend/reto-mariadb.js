fetch('../tareas.php').then
    ((response) => {
        return response.json()
    }).then((data) => {
        console.log(data);
        data.forEach(tarea => {
            renderizarTarea(tarea);

        })
        
    })  

    function renderizarTarea(tarea){

         // Representar las tareas dentro del HTML, creamos el <li>
        const elementoTarea = document.createElement("li");
        const label = document.createElement("label");

        // Creamos el <input> (checkbox)
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = tarea.completada;

            // Hacemos que al marcar el checkbox cambie el estado del objeto
            checkbox.addEventListener("click", function () {
                tarea.completada = !tarea.completada;

                // Si la tarea está completada, tacharla, sino no
                if (tarea.completada) {
                    elementoTarea.classList.add("completada");
                } else {
                    elementoTarea.classList.remove("completada");
                }
            });

            // Añadimos checkbox al <li>
            label.appendChild(checkbox);

        // Creamos el texto con el nombre de la nueva tarea
        const textoTarea = document.createTextNode(tarea.nombre);

        // Añadimos al elemento de la tarea el checkbox
        label.appendChild(textoTarea);

            // Creamos el botón de eliminar
            const botonEliminar = document.createElement("button");
            botonEliminar.textContent = "Eliminar";

            // Evento del botón eliminar
            botonEliminar.addEventListener("click", function () {

                // Confirmar borrado
                const confirmar = confirm(
                    "¿Estás seguro de que quieres eliminar " + tarea.nombre + " ?"
                );

                // Borrado del <li>
                if (confirmar) {
                    elementoTarea.remove();

                    // Borrado del array
                    const indice = tareas.indexOf(tarea);
                    tareas.splice(indice, 1);
                }
            })

        elementoTarea.appendChild(label);

        // Lo añadimos al li
        elementoTarea.appendChild(botonEliminar);

        // Añadimos el elemento a la lista de tareas 
        listaTareas.appendChild(elementoTarea);
    }