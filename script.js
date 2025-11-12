function getLocation() {
    const demoElement = document.getElementById('location-demo');
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            showPosition, 
            showError,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    } else {
        demoElement.innerHTML = "Геолокация не поддерживается вашим браузером.";
    }
}

function showPosition(position) {
    const demoElement = document.getElementById('location-demo');
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    
    demoElement.innerHTML = `
        <strong>Ваше местоположение определено:</strong><br>
        Широта: ${latitude.toFixed(6)}<br>
        Долгота: ${longitude.toFixed(6)}<br>
        <a href="https://maps.google.com/maps?q=${latitude},${longitude}" target="_blank">Посмотреть на карте</a>
    `;
}

function showError(error) {
    const demoElement = document.getElementById('location-demo');
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            demoElement.innerHTML = "Доступ к геолокации отклонен. Разрешите доступ в настройках браузера.";
            break;
        case error.POSITION_UNAVAILABLE:
            demoElement.innerHTML = "Информация о местоположении временно недоступна.";
            break;
        case error.TIMEOUT:
            demoElement.innerHTML = "Время ожидания определения местоположения истекло.";
            break;
        case error.UNKNOWN_ERROR:
            demoElement.innerHTML = "Произошла неизвестная ошибка при определении местоположения.";
            break;
    }
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});