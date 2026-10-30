// static/assets/demo/chart-area-demo.js

// Set new default font family and font color to mimic Bootstrap's default styling
Chart.defaults.global.defaultFontFamily = '-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
Chart.defaults.global.defaultFontColor = '#292b2c';

// Función para inicializar el gráfico con datos dinámicos
function inicializarGraficoComparacion(nombresRamos1, promedios1, nombresRamos2, promedios2, nombreSemestre1, nombreSemestre2) {
    var ctx = document.getElementById("myAreaChart");
    if (!ctx) {
        console.error("No se encontró el elemento canvas para el gráfico");
        return;
    }
    
    // Usar índices numéricos como labels para evitar problemas de alineación
    var maxLength = Math.max(nombresRamos1.length, nombresRamos2.length);
    var labels = [];
    
    for (var i = 0; i < maxLength; i++) {
        labels.push("Ramo " + (i + 1));
    }
    
    // Crear el gráfico
    var myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: nombreSemestre1,
                lineTension: 0.3,
                backgroundColor: "rgba(2,117,216,0.2)",
                borderColor: "rgba(2,117,216,1)",
                pointRadius: 5,
                pointBackgroundColor: "rgba(2,117,216,1)",
                pointBorderColor: "rgba(255,255,255,0.8)",
                pointHoverRadius: 7,
                pointHoverBackgroundColor: "rgba(2,117,216,1)",
                pointHitRadius: 50,
                pointBorderWidth: 2,
                data: promedios1,
            },
            {
                label: nombreSemestre2,
                lineTension: 0.3,
                backgroundColor: "rgba(255,193,7,0.2)",
                borderColor: "rgba(255,193,7,1)",
                pointRadius: 5,
                pointBackgroundColor: "rgba(255,193,7,1)",
                pointBorderColor: "rgba(255,255,255,0.8)",
                pointHoverRadius: 7,
                pointHoverBackgroundColor: "rgba(255,193,7,1)",
                pointHitRadius: 50,
                pointBorderWidth: 2,
                data: promedios2,
            }],
        },
        options: {
            scales: {
                xAxes: [{
                    gridLines: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        autoSkip: true,
                        maxRotation: 45,
                        minRotation: 45,
                        callback: function(value, index, values) {
                            // Mostrar nombre real del ramo en tooltip
                            if (index < nombresRamos1.length) {
                                return nombresRamos1[index];
                            } else if (index < nombresRamos2.length) {
                                return nombresRamos2[index];
                            }
                            return value;
                        }
                    }
                }],
                yAxes: [{
                    ticks: {
                        min: 1,
                        max: 7,
                        maxTicksLimit: 13,
                        stepSize: 0.5,
                        callback: function(value) {
                            return value.toFixed(1);
                        }
                    },
                    gridLines: {
                        color: "rgba(0, 0, 0, .125)",
                    }
                }],
            },
            legend: {
                display: true,
                position: 'top',
            },
            tooltips: {
                callbacks: {
                    label: function(tooltipItem, data) {
                        var datasetLabel = data.datasets[tooltipItem.datasetIndex].label || '';
                        var value = tooltipItem.yLabel;
                        var index = tooltipItem.index;
                        
                        // Mostrar nombre del ramo en el tooltip
                        var ramoName = "";
                        if (tooltipItem.datasetIndex === 0 && index < nombresRamos1.length) {
                            ramoName = nombresRamos1[index];
                        } else if (tooltipItem.datasetIndex === 1 && index < nombresRamos2.length) {
                            ramoName = nombresRamos2[index];
                        } else {
                            ramoName = "Ramo " + (index + 1);
                        }
                        
                        return ramoName + ' - ' + datasetLabel + ': ' + value.toFixed(2);
                    },
                    title: function(tooltipItems, data) {
                        return "";
                    }
                }
            },
            maintainAspectRatio: false,
            responsive: true
        }
    });
    
    return myLineChart;
}