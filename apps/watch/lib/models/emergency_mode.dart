enum WatchEmergencyMode {
  normalSos('NormalSOS', 'General SOS'),
  silentSos('SilentSOS', 'Silent SOS'),
  medicalSos('MedicalSOS', 'Medical'),
  kidnappingSos('KidnappingSOS', 'Kidnapping'),
  fireSos('FireSOS', 'Fire'),
  childSos('ChildSOS', 'Child Safety'),
  womenSafetySos('WomenSafetySOS', 'Women Safety');

  const WatchEmergencyMode(this.apiValue, this.label);
  final String apiValue;
  final String label;
}
