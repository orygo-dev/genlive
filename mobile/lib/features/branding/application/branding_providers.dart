import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:genmeet/app/config/providers.dart';
import 'package:genmeet/core/constants/api_paths.dart';
import 'package:genmeet/core/network/api_client.dart';

class MobileBannerSlide extends Equatable {
  const MobileBannerSlide({
    required this.id,
    required this.imageUrl,
    this.title = '',
    this.body = '',
    this.active = true,
  });

  final String id;
  final String imageUrl;
  final String title;
  final String body;
  final bool active;

  factory MobileBannerSlide.fromJson(Map<String, dynamic> json) {
    return MobileBannerSlide(
      id: (json['id'] as String?)?.trim() ?? '',
      imageUrl: (json['imageUrl'] as String?)?.trim() ?? '',
      title: (json['title'] as String?)?.trim() ?? '',
      body: (json['body'] as String?)?.trim() ?? '',
      active: json['active'] != false,
    );
  }

  @override
  List<Object?> get props => [id, imageUrl, title, body, active];
}

class PlatformBrandingInfo extends Equatable {
  const PlatformBrandingInfo({
    required this.appName,
    this.logoUrl,
    this.mobileBannerSlides = const [],
  });

  final String appName;
  final String? logoUrl;
  final List<MobileBannerSlide> mobileBannerSlides;

  factory PlatformBrandingInfo.fromJson(Map<String, dynamic> json) {
    final slidesRaw = json['mobileBannerSlides'];
    final slides = <MobileBannerSlide>[];
    if (slidesRaw is List) {
      for (final entry in slidesRaw) {
        if (entry is Map<String, dynamic>) {
          final slide = MobileBannerSlide.fromJson(entry);
          if (slide.id.isNotEmpty &&
              slide.imageUrl.isNotEmpty &&
              slide.active) {
            slides.add(slide);
          }
        }
      }
    }
    return PlatformBrandingInfo(
      appName: (json['appName'] as String?)?.trim().isNotEmpty == true
          ? (json['appName'] as String).trim()
          : 'GenMeet',
      logoUrl: (json['logoUrl'] as String?)?.trim(),
      mobileBannerSlides: slides,
    );
  }

  @override
  List<Object?> get props => [appName, logoUrl, mobileBannerSlides];
}

class BrandingRemoteDataSource {
  BrandingRemoteDataSource(this._api);

  final ApiClient _api;

  Future<PlatformBrandingInfo> fetchBranding() async {
    final response = await _api.get<Map<String, dynamic>>(ApiPaths.branding);
    final payload = response.data ?? const <String, dynamic>{};
    final branding = payload['branding'];
    if (branding is Map<String, dynamic>) {
      return PlatformBrandingInfo.fromJson(branding);
    }
    return const PlatformBrandingInfo(appName: 'GenMeet');
  }
}

final brandingRemoteDataSourceProvider = Provider<BrandingRemoteDataSource>((
  ref,
) {
  return BrandingRemoteDataSource(ref.watch(apiClientProvider));
});

final platformBrandingProvider = FutureProvider<PlatformBrandingInfo>((
  ref,
) async {
  try {
    return await ref.watch(brandingRemoteDataSourceProvider).fetchBranding();
  } catch (_) {
    return const PlatformBrandingInfo(appName: 'GenMeet');
  }
});

String resolveBrandAssetUrl(String apiBaseUrl, String pathOrUrl) {
  final value = pathOrUrl.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  final base = apiBaseUrl.endsWith('/')
      ? apiBaseUrl.substring(0, apiBaseUrl.length - 1)
      : apiBaseUrl;
  if (value.startsWith('/')) return '$base$value';
  return '$base/$value';
}
