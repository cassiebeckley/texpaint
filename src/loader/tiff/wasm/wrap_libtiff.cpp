#include <emscripten/bind.h>
#include <sstream>
#include "tiffio.h"
#include "tiffio.hxx"

using namespace emscripten;

class TIFFLoader {
    private:
    uint32 width_;
    uint32 height_;
    std::vector<uint32> image; // ABGR
    bool is_ok;
    public:
    TIFFLoader(const std::string &binary) {
        std::istringstream input_stream(binary);

        is_ok = false;

        TIFF *tiff = TIFFStreamOpen("filename", &input_stream);
        if (tiff) {
            TIFFGetField(tiff, TIFFTAG_IMAGEWIDTH, &width_);
            TIFFGetField(tiff, TIFFTAG_IMAGELENGTH, &height_);
            image.resize(width_ * height_);
            if (TIFFReadRGBAImageOriented(tiff, width_, height_, image.data(), ORIENTATION_TOPLEFT)) {
                is_ok = true;
            }
        }

        TIFFClose(tiff);
    }
    ~TIFFLoader() {}

    // Return as memory views
    emscripten::val getBytes() const {
    return emscripten::val(
        emscripten::typed_memory_view(image.size(), image.data()));
    }

    bool ok() const { return is_ok; }

    int width() const { return width_; }

    int height() const { return height_; }
};

EMSCRIPTEN_BINDINGS(libtiff_module) {
  class_<TIFFLoader>("TIFFLoader")
      .constructor<const std::string &>()
      .function("getBytes", &TIFFLoader::getBytes)
      .function("ok", &TIFFLoader::ok)
      .function("width", &TIFFLoader::width)
      .function("height", &TIFFLoader::height);
}