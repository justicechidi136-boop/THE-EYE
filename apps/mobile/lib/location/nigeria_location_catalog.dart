abstract class LocationSelectionProvider {
  List<String> get states;
  List<String> citiesForState(String state);
}

class NigeriaLocationCatalog implements LocationSelectionProvider {
  const NigeriaLocationCatalog();

  static const otherCityTown = "Other city/town";

  static const Map<String, List<String>> _cities = {
    "Abia": ["Umuahia", "Aba"],
    "Adamawa": ["Yola", "Mubi"],
    "Akwa Ibom": ["Uyo", "Eket"],
    "Anambra": ["Awka", "Onitsha", "Nnewi"],
    "Bauchi": ["Bauchi"],
    "Bayelsa": ["Yenagoa"],
    "Benue": ["Makurdi", "Gboko"],
    "Borno": ["Maiduguri"],
    "Cross River": ["Calabar", "Ikom"],
    "Delta": ["Asaba", "Warri", "Sapele"],
    "Ebonyi": ["Abakaliki"],
    "Edo": ["Benin City", "Auchi"],
    "Ekiti": ["Ado-Ekiti"],
    "Enugu": ["Enugu", "Nsukka"],
    "Federal Capital Territory": ["Abuja", "Gwagwalada"],
    "Gombe": ["Gombe"],
    "Imo": ["Owerri", "Orlu"],
    "Jigawa": ["Dutse"],
    "Kaduna": ["Kaduna", "Zaria"],
    "Kano": ["Kano"],
    "Katsina": ["Katsina"],
    "Kebbi": ["Birnin Kebbi"],
    "Kogi": ["Lokoja", "Okene"],
    "Kwara": ["Ilorin"],
    "Lagos": ["Lagos", "Ikeja", "Epe", "Badagry"],
    "Nasarawa": ["Lafia", "Keffi"],
    "Niger": ["Minna", "Suleja"],
    "Ogun": ["Abeokuta", "Ijebu-Ode", "Ota"],
    "Ondo": ["Akure", "Ondo"],
    "Osun": ["Osogbo", "Ile-Ife", "Ilesa"],
    "Oyo": ["Ibadan", "Ogbomoso"],
    "Plateau": ["Jos"],
    "Rivers": ["Port Harcourt", "Bonny", "Bori"],
    "Sokoto": ["Sokoto"],
    "Taraba": ["Jalingo"],
    "Yobe": ["Damaturu", "Potiskum"],
    "Zamfara": ["Gusau"],
  };

  @override
  List<String> get states => _cities.keys.toList(growable: false);

  @override
  List<String> citiesForState(String state) => [
        ...?_cities[state],
        otherCityTown,
      ];
}
