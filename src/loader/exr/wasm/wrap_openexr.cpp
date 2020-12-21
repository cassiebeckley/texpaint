#include <vector>
#include <sstream>

#include <emscripten/bind.h>

#include "install/include/OpenEXR/ImfRgbaFile.h"
#include "install/include/OpenEXR/ImfArray.h"
#include "install/include/OpenEXR/ImfStdIO.h"

using namespace emscripten;

///
/// Simple C++ wrapper class for Emscripten
///
class EXRLoader {
 public:
  ///
  /// `binary` is the buffer for EXR binary(e.g. buffer read by fs.readFileSync)
  /// ::std::string can be used as UInt8Array in JS layer.
  ///
  EXRLoader(const ::std::string &binary) {
    Imf::StdISStream input_stream;
    input_stream.str(binary);

    Imf::RgbaInputFile file(input_stream);
    Imath::Box2i dw = file.dataWindow();

    width_ = dw.max.x - dw.min.x + 1;
    height_ = dw.max.y - dw.min.y + 1;
    Imf::Array2D<Imf::Rgba> pixels(width_, height_);

    file.setFrameBuffer(&pixels[0][0] - dw.min.x - dw.min.y * width_, 1, width_);
    file.readPixels(dw.min.y, dw.max.y);

    data.resize(height_ * width_ * 4);

    int data_i = 0;

    for (int x = 0; x < width_; x++) {
        for (int y = 0; y < height_; y++) {
            Imf::Rgba pixel = pixels[x][y];

            data[data_i++] = pixel.r;
            data[data_i++] = pixel.g;
            data[data_i++] = pixel.b;
            data[data_i++] = pixel.a;
        }
    }
  }
  ~EXRLoader() {}

  // Return as memory views
  emscripten::val getBytes() const {
    return emscripten::val(
        emscripten::typed_memory_view(data.size(), data.data())
    );
  }

  int width() const { return width_; }

  int height() const { return height_; }

  private:
  ::std::vector<float> data;
  long width_;
  long height_;
};

// Register STL
EMSCRIPTEN_BINDINGS(stl_wrappters) { register_vector<float>("VectorFloat"); }

EMSCRIPTEN_BINDINGS(tinyexr_module) {
  class_<EXRLoader>("EXRLoader")
      .constructor<const ::std::string &>()
      .function("getBytes", &EXRLoader::getBytes)
      .function("width", &EXRLoader::width)
      .function("height", &EXRLoader::height);
}