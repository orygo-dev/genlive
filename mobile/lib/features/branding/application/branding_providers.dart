import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:genmeet/app/config/providers.dart';
import 'package:genmeet/core/constants/api_paths.dart';
import 'package:genmeet/core/network/api_client.dart';

/// Matches platform `MobileBannerSlide` from super-admin branding.
class MobileBannerSlide extends Equatable {
  const MobileBannerSlide({
    required this.id,
    required this.imageUrl,
    this.title = '',
    this.body = '',
    this.linkUrl,
    this.active = true,
  });

  final String id;
  final String imageUrl;
  final String title;
  final String body;
  final String? linkUrl;
  final bool active;

  factory MobileBannerSlide.fromJson(Map<String, dynamic> json) {
    final link = (json['linkUrl'] as String?)?.trim();
    return MobileBannerSlide(
      id: (json['id'] as String?)?.trim() ?? '',
      imageUrl: (json['imageUrl'] as String?)?.trim() ?? '',
      title: (json['title'] as String?)?.trim() ?? '',
      body: (json['body'] as String?)?.trim() ?? '',
      linkUrl: (link != null && link.isNotEmpty) ? link : null,
      active: json['active'] != false,
    );
  }

  @override
  List<Object?> get props => [id, imageUrl, title, body, linkUrl, active];
}

/// Matches platform `MobilePopupAd` — cold-start image popup.
class MobilePopupAd extends Equatable {
  const MobilePopupAd({
    this.enabled = false,
    this.imageUrl,
    this.linkUrl,
    this.updatedAt,
  });

  final bool enabled;
  final String? imageUrl;
  final String? linkUrl;
  final String? updatedAt;

  bool get canShow =>
      enabled && imageUrl != null && imageUrl!.trim().isNotEmpty;

  factory MobilePopupAd.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const MobilePopupAd();
    final image = (json['imageUrl'] as String?)?.trim();
    final link = (json['linkUrl'] as String?)?.trim();
    final updated = (json['updatedAt'] as String?)?.trim();
    return MobilePopupAd(
      enabled: json['enabled'] == true && image != null && image.isNotEmpty,
      imageUrl: (image != null && image.isNotEmpty) ? image : null,
      linkUrl: (link != null && link.isNotEmpty) ? link : null,
      updatedAt: (updated != null && updated.isNotEmpty) ? updated : null,
    );
  }

  @override
  List<Object?> get props => [enabled, imageUrl, linkUrl, updatedAt];
}

class PlatformBrandingInfo extends Equatable {
  const PlatformBrandingInfo({
    required this.appName,
    this.logoUrl,
    this.mobileBannerSlides = const [],
    this.mobilePopupAd = const MobilePopupAd(),
  });

  final String appName;
  final String? logoUrl;
  final List<MobileBannerSlide> mobileBannerSlides;
  final MobilePopupAd mobilePopupAd;

  /// Admin-recommended banner asset ratio (1080×432).
  static const double mobileBannerAspectRatio = 2.5;

  factory PlatformBrandingInfo.fromJson(Map<String, dynamic> json) {
    final slidesRaw = json['mobileBannerSlides'];
    final slides = <MobileBannerSlide>[];
    if (slidesRaw is List) {
      for (final entry in slidesRaw) {
        if (entry is! Map) continue;
        final slide = MobileBannerSlide.fromJson(
          Map<String, dynamic>.from(entry),
        );
        if (slide.id.isNotEmpty && slide.imageUrl.isNotEmpty && slide.active) {
          slides.add(slide);
        }
        if (slides.length >= 5) break;
      }
    }
    final popupRaw = json['mobilePopupAd'];
    return PlatformBrandingInfo(
      appName: (json['appName'] as String?)?.trim().isNotEmpty == true
          ? (json['appName'] as String).trim()
          : 'GenMeet',
      logoUrl: (json['logoUrl'] as String?)?.trim(),
      mobileBannerSlides: slides,
      mobilePopupAd: MobilePopupAd.fromJson(
        popupRaw is Map ? Map<String, dynamic>.from(popupRaw) : null,
      ),
    );
  }

  @override
  List<Object?> get props => [appName, logoUrl, mobileBannerSlides, mobilePopupAd];
}

class BrandingRemoteDataSource {
  BrandingRemoteDataSource(this._api);

  final ApiClient _api;

  Future<PlatformBrandingInfo> fetchBranding() async {
    final response = await _api.get<Map<String, dynamic>>(ApiPaths.branding);
    final payload = response.data ?? const <String, dynamic>{};
    final branding = payload['branding'];
    if (branding is Map) {
      return PlatformBrandingInfo.fromJson(Map<String, dynamic>.from(branding));
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

/// In-memory gate: popup shows once per app process (cold start), not on refresh.
final popupAdShownThisSessionProvider = StateProvider<bool>((ref) => false);

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
