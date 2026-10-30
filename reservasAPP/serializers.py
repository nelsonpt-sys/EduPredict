from rest_framework import serializers
from reservasAPP.models import Reserva
from django.core.validators import MinValueValidator, MaxValueValidator


class ReservaSerializer(serializers.ModelSerializer):

    cantidad = serializers.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(15)])
    observacion = serializers.CharField(allow_blank=True, required=False)

    class Meta:
        model = Reserva
        fields = '__all__'

    def validate(self, data):
        
        required_fields = ['nombre', 'telefono', 'fecha', 'hora', 'cantidad', 'estado']
        for field in required_fields:
            if field not in data or data[field] in [None, '']:
                raise serializers.ValidationError({field: f"{field} es obligatorio, por favor ingrese un dato"})
        return data