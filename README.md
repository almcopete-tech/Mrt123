# Dash Prisma

Dash Prisma es un juego web tipo runner rítmico inspirado en la energía de Geometry Dash. Controlas un cubo/nave de neón, esquivas picos, usas orbes, atraviesas portales y compites por la mayor distancia posible.

## Cómo jugar

1. Abre `index.html` directamente en un navegador o sirve la carpeta con un servidor estático.
2. Pulsa **Comenzar**.
3. Usa **Espacio**, **↑**, **W** o toca la pantalla para saltar.
4. En modo nave, mantén pulsado para subir y suelta para bajar.

## Ejecutar localmente

```bash
python3 -m http.server 8000
```

Después visita <http://127.0.0.1:8000/index.html>.

## Características

- Obstáculos variados: picos, bloques, orbes y portales.
- Cambio entre modo cubo y modo nave.
- Portales de gravedad.
- Velocidad progresiva y escenario infinito.
- Mejor marca guardada con `localStorage`.
- Diseño responsive con estética neón.
