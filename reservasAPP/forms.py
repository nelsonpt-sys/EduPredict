from django import forms
from reservasAPP.models import Estado, Reserva, Comentario, TIPO_FEEDBACK_CHOICES
from django.core.validators import MinValueValidator, MaxValueValidator
from .models import Ramo, Semestre


class CrearRamoForm(forms.ModelForm):
    tiene_examen = forms.BooleanField(required=False, label="¿Tiene examen?")
    semestre = forms.ModelChoiceField(
        queryset=Semestre.objects.none(),
        label="Semestre",
        required=True,
        empty_label="Selecciona un semestre"
    )

    class Meta:
        model = Ramo
        fields = ["nombre", "tiene_examen", "semestre"]

    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.fields['semestre'].queryset = Semestre.objects.filter(user=user)


class NotaForm(forms.Form):
    nota = forms.FloatField(required=False, label="Nota")
    porcentaje = forms.FloatField(label="Porcentaje")
    es_examen = forms.BooleanField(required=False)


class ComentarioForm(forms.ModelForm):
    nombre = forms.CharField(
        max_length=100,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre *'
        })
    )

    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Email *'
        })
    )

    telefono = forms.CharField(
        max_length=20,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Teléfono *',
            'pattern': r'^\+?\d{8,13}$'
        }),
        help_text='Formato: +56949079105, 949079105 o 49079105'
    )

    mensaje = forms.CharField(
        required=True,
        max_length=200,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Tu comentario (máximo 200 caracteres) *',
            'rows': 5,
            'maxlength': '200'
        })
    )

    # Campo para guardar el tipo de feedback desde el hidden input de la landing
    tipo_feedback = forms.ChoiceField(
        choices=TIPO_FEEDBACK_CHOICES,
        required=False,
        initial='comentario',
    )

    class Meta:
        model = Comentario
        fields = ['nombre', 'email', 'telefono', 'mensaje', 'tipo_feedback']


class ReservaForm(forms.ModelForm):
    nombre = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control'}))
    telefono = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control'}))
    fecha = forms.DateField(widget=forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}))
    hora = forms.TimeField(widget=forms.TimeInput(attrs={'type': 'time', 'class': 'form-control'}))
    cantidad = forms.IntegerField(widget=forms.NumberInput(attrs={'class': 'form-control'}), validators=[MinValueValidator(1), MaxValueValidator(15)])
    estado = forms.ModelChoiceField(queryset=Estado.objects.all(), widget=forms.Select(attrs={'class': 'form-control'}))

    class Meta:
        model = Reserva
        fields = '__all__'


class EstadoForm(forms.ModelForm):
    estado = forms.CharField()
    estado.widget.attrs['class'] = 'form-control'

    class Meta:
        model = Estado
        fields = '__all__'